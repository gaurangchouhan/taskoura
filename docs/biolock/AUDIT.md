# Taskoura BioLock: Architecture & Repository Audit (BL-0)

**Date:** 2026-11-26  
**Auditor:** Antigravity  
**Target Repository:** Taskoura (Spring Boot 3.4.1 Java 21 / React 18 TypeScript Vite Tailwind)  
**Status:** Audit Complete — Zero source modifications made.

---

## 1. User, Project, Ownership (Leader) and Membership Model

### Entities & Database Mapping
- **`User`** (`backend/src/main/java/com/taskoura/entity/User.java`):
  - Table: `users`
  - Key attributes: `id` (UUID, PK), `email` (unique, indexed), `name`, `passwordHash`, `passwordLoginEnabled` (boolean), `verified` (boolean), OTP & reset fields, `createdAt`.
- **`Project`** (`backend/src/main/java/com/taskoura/entity/Project.java`):
  - Table: `projects`
  - Key attributes: `id` (UUID, PK), `name`, `description`, `owner` (`@ManyToOne` mapping to `User`, column `owner_id`, not null), tech stack strings, `deadline` (LocalDate), `createdAt`, `deletedAt`, `deletedBy`.
  - Soft-delete semantics: `@SQLDelete(sql = "UPDATE projects SET deleted_at = now() WHERE id = ?")` and `@SQLRestriction("deleted_at IS NULL")`.
- **`ProjectMember`** (`backend/src/main/java/com/taskoura/entity/ProjectMember.java`):
  - Table: `project_members`
  - Constraints: Unique constraint on `(project_id, user_id)`.
  - Key attributes: `id` (UUID, PK), `project` (`@ManyToOne Project`), `user` (`@ManyToOne User`), `role` (String: `"Owner"` or `"Member"`).

### Ownership and Access Enforcement
- **`ProjectAccessService`** (`backend/src/main/java/com/taskoura/service/ProjectAccessService.java`):
  - `requireMember(UUID projectId, String email)`: Resolves user by email; checks if user is direct `project.getOwner()` OR has a row in `project_members`. Throws `ForbiddenException("You are not a member of this project")` (HTTP 403) if neither.
  - `requireOwner(UUID projectId, String email)`: Resolves user; checks if resolved role is `"Owner"` (either `project.getOwner()` matches user ID/email OR `ProjectMember.role` is `"Owner"`). Throws `ForbiddenException("Only the project owner has access")` (HTTP 403) if not.
  - `requireTaskAccess(UUID taskId, String email)`: Fetches `Task` $\to$ gets `task.getProject()` $\to$ invokes `requireMember(projectId, email)`.
- **`ProjectMemberService`** (`backend/src/main/java/com/taskoura/service/ProjectMemberService.java`):
  - Handles member invitations, role changes, and removal. Prevents removing the last remaining `"Owner"`.

---

## 2. Project Creation & Deletion Flows

### Backend Flow
- **Creation** (`backend/src/main/java/com/taskoura/service/ProjectService.java#createProject`):
  - Endpoint: `POST /api/projects` in `ProjectController.java`.
  - Resolves authenticated user from JWT email (`authentication.getName()`).
  - Builds and saves `Project` with `owner = user`.
  - Automatically inserts a `ProjectMember` row with `role = "Owner"` for that user.
- **Deletion** (`backend/src/main/java/com/taskoura/service/ProjectService.java#deleteProject`):
  - Endpoint: `DELETE /api/projects/{id}` in `ProjectController.java`.
  - Enforces `project.getOwner().getId().equals(user.getId())` (only direct owner can delete).
  - Soft deletion strategy:
    1. Bulk soft-deletes tasks: `taskRepository.softDeleteAllByProjectId(projectId, user, now)`.
    2. Soft-deletes project: `projectRepository.softDeleteProject(projectId, user, now)`.
  - Database records are NOT purged; rows remain in Neon PostgreSQL with `deleted_at = now()`.

### Frontend Flow
- **Creation** (`frontend/src/components/projects/CreateProjectModal.tsx`):
  - Modal triggered from projects dashboard. Invokes `useCreateProject().mutateAsync()`.
  - On 201 response: invalidates `queryKeys.projects.all` and navigates to `/app/projects/{id}`.
- **Deletion** (`frontend/src/components/projects/DeleteProjectModal.tsx`):
  - Requires user to type the exact project title before unlocking the Delete button.
  - Calls `useDeleteProject().mutateAsync(project.id)`.

---

## 3. Attachment Entity, Storage, and File Delivery

### Attachment Entity
- File: `backend/src/main/java/com/taskoura/entity/Attachment.java`
- Table: `attachments`
- Fields:
  - `id` (UUID, PK)
  - `task` (`@ManyToOne Task`, not null, column `task_id`)
  - `uploadedBy` (`@ManyToOne User`, not null, column `uploaded_by`)
  - `fileUrl` (`@Column(nullable = false, length = 1024) String`)
  - `fileType` (`String`, e.g. `image/png`, `application/pdf`)
  - `fileName` (`String`)
  - `uploadedAt` (`LocalDateTime`, defaults to `now()`)

### Storage Implementation
- Service: `CloudinaryAttachmentStorageService` (`backend/src/main/java/com/taskoura/service/CloudinaryAttachmentStorageService.java`), implementing `AttachmentStorageService`.
- Configuration:
  - `cloudinary.cloud-name`, `cloudinary.api-key`, `cloudinary.api-secret` in `application.properties`.
- Upload mechanism:
  - `cloudinary.uploader().upload(file.getBytes(), ObjectUtils.asMap("resource_type", "auto"))`.
  - Returns Cloudinary `secure_url` (or `url`), e.g. `https://res.cloudinary.com/<cloud>/raw/upload/v12345/filename.pdf` or `/image/upload/...`.
  - Stored verbatim in `attachments.file_url`.
- Download mechanism:
  - `CloudinaryAttachmentStorageService.downloadFile(fileUrl)` performs direct HTTP GET against `fileUrl`, with fallback to authenticated Cloudinary asset download API.

### Endpoints & Delivery
- **Upload**: `POST /api/tasks/{taskId}/attachments` (`AttachmentController.java`). Authenticated; requires task membership.
- **List**: `GET /api/tasks/{taskId}/attachments`. Authenticated; requires task membership. Returns `List<AttachmentResponse>`.
  - `AttachmentDtos.AttachmentResponse` exposes: `id`, `taskId`, `uploadedBy`, `uploadedByName`, `fileUrl`, `fileType`, `fileName`, `uploadedAt`.
- **Download**: `GET /api/attachments/{attachmentId}/download`.
  - **CRITICAL SECURITY NOTE:** This endpoint currently has **NO authentication check**. It does not inspect `Authentication` or membership.
  - Furthermore, in `SecurityConfig.java` (line 183), `"/api/attachments/*/download"` is explicitly marked `.permitAll()`!
  - In frontend (`frontend/src/features/attachments/components/AttachmentItem.jsx`):
    - Images render thumbnail directly: `<img src={attachment.fileUrl} />`.
    - Clicking the file opens `downloadUrl = /api/attachments/${attachment.id}/download` in `target="_blank"`.

---

## 4. Security Configuration, Filter Chains, & CORS

### Filter Chains (`backend/src/main/java/com/taskoura/config/SecurityConfig.java`)
1. **OAuth Chain (`@Order(1) oauthSecurityFilterChain`)**:
   - Matches: `/oauth2/**`, `/login/oauth2/**`.
   - Manages OAuth2 authorization requests, state cookies, and callbacks.
2. **API Chain (`@Order(2) apiSecurityFilterChain`)**:
   - Matches: `/**` (all other traffic).
   - Session policy: `SessionCreationPolicy.STATELESS`.
   - Filters: `JwtAuthFilter` added before `UsernamePasswordAuthenticationFilter`.
   - `permitAll` rules:
     - OPTIONS (pre-flight)
     - `/error`, `/api/health`
     - `/api/attachments/*/download`
     - Auth endpoints: `/api/auth/register`, `/api/auth/verify-otp`, `/api/auth/resend-otp`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/oauth/providers`, `/api/auth/oauth/exchange`.
     - Everything else: `.anyRequest().authenticated()`.

### JWT & Session Filter (`backend/src/main/java/com/taskoura/security/JwtAuthFilter.java`)
- Bypasses public endpoints (`isPublicPath`).
- Extracts Bearer token, parses claims, extracts `email` (subject) and `sid` (session UUID).
- Validates token expiration using injected `Clock`.
- Checks database session via `SessionService.getSession(sessionId)`.
- Rejection handling: sends JSON 401 with code `UNAUTHENTICATED` or `SESSION_EXPIRED`.
- **Background Request Rule:**
  - `isBackgroundRequest(request)` checks if `X-Background-Request: true` or `GET /api/auth/session`.
  - If background request, `sessionService.touchSession()` is skipped so background polling does not keep inactive sessions open.

### CORS Configuration (`backend/src/main/java/com/taskoura/config/CorsConfig.java`)
- Allowed origin patterns: `https://*.vercel.app`, `https://taskoura.vercel.app`, `http://localhost:[*]`, `http://127.0.0.1:[*]`.
- Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD.
- Exposed headers: `Authorization`, `Content-Disposition`, `X-Total-Count`.
  - *Contract requirement:* Must also expose `Retry-After` for 429 rate limit responses.

---

## 5. Global Exception Handler Error Shape

### Implementation (`backend/src/main/java/com/taskoura/exception/GlobalExceptionHandler.java`)
- All exceptions resolve to a unified, standardized JSON error structure:
  ```json
  {
    "status": 403,
    "error": "Forbidden",
    "code": "BIOLOCK_ACCESS_REQUIRED",
    "message": "Project document requires leader biometric verification",
    "timestamp": "2026-11-26T08:15:00.000Z",
    "path": "/api/attachments/123e4567-e89b-12d3-a456-426614174000/content",
    "fieldErrors": {}
  }
  ```
- Handlers include:
  - `ForbiddenException` $\to$ HTTP 403 `FORBIDDEN`
  - `ConflictException` $\to$ HTTP 409 `e.getCode()` or `CONFLICT`
  - `RateLimitedException` $\to$ HTTP 429 `RATE_LIMITED` (includes `retryAfterSeconds`)
  - `NotFoundException` $\to$ HTTP 404 `NOT_FOUND`
  - `ValidationException` / `BadRequestException` $\to$ HTTP 400 `VALIDATION_FAILED`

---

## 6. Email Service, Templates, and Notification Preferences

### Implementation (`backend/src/main/java/com/taskoura/service/EmailService.java`)
- JavaMailSender with Thymeleaf templates in `backend/src/main/resources/templates/email/*.html`.
- Asynchronous pool: `@Async("emailTaskExecutor")` defined in `AsyncConfig.java` (ThreadPoolTaskExecutor: core 2, max 10, queue 500).
- User notification preferences: Evaluated per-user against `UserProfile` preferences (`isPrefProjectInvites`, `isPrefTaskAssigned`, `isPrefDeadlineReminders`, `isPrefMentions`), defaulting to true if profile not yet created.
- Existing templates:
  - `verification-code.html`, `password-reset.html`, `welcome.html`, `password-changed.html`, `project-invite.html`, `task-assigned.html`, `deadline-reminder.html`, `mention.html`, `task-status-changed.html`.

---

## 7. Schema Changes and Migration Strategy

### Configuration (`backend/src/main/resources/application.properties`)
```properties
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
spring.jpa.show-sql=true
```
- In development/test environments, Hibernate `ddl-auto=update` automatically reflects new JPA entities and fields.
- There is NO Flyway, Liquibase, or auto-executing `schema.sql`.
- Production migrations (Neon PostgreSQL) are versioned as manual SQL scripts under `backend/docs/migrations/` (e.g. `social-login.sql`).
- BioLock migration will be authored as `backend/docs/migrations/biolock.sql` with idempotent statements (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and a complete rollback section.

---

## 8. Frontend Architecture Audit

### Target Components
1. **`CreateProjectModal.tsx`** (`frontend/src/components/projects/CreateProjectModal.tsx`):
   - Form fields: Name, description, tech stack (Frontend, Backend, Database, Testing), deadline.
   - For BioLock (BL-5): Can provide a toggle "Enable BioLock document protection" if the current user has an enrolled BioLock credential.
2. **`DeleteProjectModal.tsx`** (`frontend/src/components/projects/DeleteProjectModal.tsx`):
   - Requires typing project title. Deletes project and soft-deletes tasks.
3. **`TaskPanel.tsx`** (`frontend/src/components/tasks/TaskPanel.tsx`):
   - Slide-over drawer managing task details, subtasks, comments, status logs, quality tests, and attachments. Mounts `<AttachmentsSection />`.
4. **`AttachmentsSection.jsx`** & **`AttachmentItem.jsx`** (`frontend/src/features/attachments/components/`):
   - Lists attachments for the active task.
   - For BioLock: Needs to display restriction badges (`LOCKED`, `RESTRICTED`, `PENDING`), access request triggers, countdown timers, and restricted file download handling.
5. **`AuthContext.tsx`** (`frontend/src/context/AuthContext.tsx`):
   - Manages token, user profile, and active session info. Coordinates session timeout, idle timers, and cross-tab BroadcastChannel events.
6. **`services/api.ts`** (`frontend/src/services/api.ts`):
   - Axios client attaching `Authorization: Bearer <token>`.
   - Handles slow server waking toasts.
   - Interceptor: catches 401 (redirects to login) and 403 (does NOT redirect if valid token exists, rejecting the error cleanly so UI can catch `BIOLOCK_ACCESS_REQUIRED`).
7. **`lib/queryKeys.ts`** (`frontend/src/lib/queryKeys.ts`):
   - Centralized query keys. Needs `biolock: { status: ..., devices: ..., access: ... }`.
8. **Session Background Header**:
   - `notificationService.ts` passes `X-Background-Request: true`.
   - Polling for BioLock access request status (`GET /api/attachments/{id}/access`) must also pass `X-Background-Request: true` so polling does not artificially reset session idle timeouts.

---

## 9. Existing Device or Biometric Code

- **Audit Result:** Zero existing device, ESP32, sensor, fingerprint, or BioLock code exists in the repository. The feature is an entirely clean, additive implementation.

---

## 10. Security Audit: What is NOT Public-Safe Today

> [!CAUTION]
> ### Critical Existing Security Vulnerabilities Around Attachments
> 1. **Public Cloudinary CDN URLs Leaked in API Responses:**
>    `GET /api/tasks/{taskId}/attachments` returns `fileUrl` directly in `AttachmentResponse`. Cloudinary URLs (`https://res.cloudinary.com/...`) are world-readable over the public Internet. Anyone who views network traffic or parses the API JSON can download the file directly from Cloudinary CDN without touching the Taskoura backend.
> 2. **Unauthenticated Download Endpoint:**
>    `GET /api/attachments/{attachmentId}/download` in `AttachmentController.java` performs NO authentication or project membership verification. It is also explicitly listed as `.permitAll()` in `SecurityConfig.java`. Anyone who knows or discovers an attachment UUID can stream the file without credentials.
> 3. **Direct Thumbnail Rendering:**
>    `AttachmentItem.jsx` renders `<img src={attachment.fileUrl} />`, leaking the direct public Cloudinary URL directly into the browser DOM.

### Required BioLock Remediation (Additive & Public-Safe):
1. **Restricted Attachment DTO Masking:**
   When an attachment is marked `restricted = true`, `fileUrl` in `AttachmentResponse` MUST be `null` or a masked URL unless the requesting user is the project owner or has an active approved BioLock access grant.
2. **Authenticated File Streaming Endpoint:**
   `GET /api/attachments/{id}/content` (JWT-authenticated) must be used for restricted files. It checks:
   - Is project BioLock enabled?
   - Is attachment restricted?
   - Is caller the project leader (owner) OR does caller have an active `APPROVED` access request in `bio_lock_access_requests` where `access_expires_at > now()`?
   - If allowed: streams the byte array from Cloudinary with `Cache-Control: no-store` and `Pragma: no-cache`.
   - If disallowed: returns HTTP 403 with code `BIOLOCK_ACCESS_REQUIRED`.
3. **Preserve Legacy Unrestricted Compatibility:**
   Unrestricted attachments continue to work without breaking existing project boards.

---

## 11. Conflicts with the CONTRACT & Mitigations

| Item | Existing State | CONTRACT Requirement | Resolution |
| :--- | :--- | :--- | :--- |
| **Device Filter Chain** | Only 2 chains exist (`oauth` and `api`). `api` requires JWT or public. | Separate filter chain for `/api/device/biolock/**` with HMAC auth and no JWT. | Add `@Order(1)` `deviceSecurityFilterChain` in `SecurityConfig.java` matching `/api/device/biolock/**`. |
| **Download Auth** | `/api/attachments/*/download` is `permitAll()` with no token check. | Restricted documents stream only via `GET /api/attachments/{id}/content` (JWT) with access check. | Leave legacy `/download` intact for backward compatibility, add secure `/content` endpoint, and protect `/download` if restricted. |
| **CORS Exposed Headers** | Only `Authorization`, `Content-Disposition`, `X-Total-Count` exposed. | Device and API return 429 with `Retry-After`. | Add `Retry-After` to `CorsConfig.java` exposed headers. |
| **Frontend Download Bypass** | `api.ts` considers `/api/attachments/*/download` public and omits `Authorization` header. | BioLock content endpoint requires JWT. | Keep `api.ts` public exclusion strict, ensure `/api/attachments/*/content` sends `Authorization: Bearer <token>`. |

---

## 12. Implementation Plan & File Matrix (BL-2 to BL-6)

### Module BL-2: Data Model (Backend)
- **Files to Create:**
  - `backend/src/main/java/com/taskoura/entity/BioLockDevice.java` (`id`, `deviceId`, `name`, `keyVersion`, `status`, `lastSeenAt`, `owner`, `createdAt`)
  - `backend/src/main/java/com/taskoura/entity/BioLockCredential.java` (`id`, `owner`, `device`, `sensorSlotId`, `status`, `createdAt`, `revokedAt`)
  - `backend/src/main/java/com/taskoura/entity/BioLockJob.java` (`id`, `device`, `type`, `status`, `expectedSlot`, `slot`, `challenge`, `claimedAt`, `leaseExpiresAt`, `expiresAt`, `outcome`, `proof`, `createdAt`, `completedAt`)
  - `backend/src/main/java/com/taskoura/entity/BioLockAccessRequest.java` (`id`, `attachment`, `requester`, `status`, `expiresAt`, `accessExpiresAt`, `job`, `createdAt`, `decidedAt`)
  - `backend/src/main/java/com/taskoura/entity/BioLockNonce.java` (`nonce`, `createdAt`)
  - Repositories:
    - `backend/src/main/java/com/taskoura/repository/BioLockDeviceRepository.java`
    - `backend/src/main/java/com/taskoura/repository/BioLockCredentialRepository.java`
    - `backend/src/main/java/com/taskoura/repository/BioLockJobRepository.java`
    - `backend/src/main/java/com/taskoura/repository/BioLockAccessRequestRepository.java`
    - `backend/src/main/java/com/taskoura/repository/BioLockNonceRepository.java`
  - DTOs:
    - `backend/src/main/java/com/taskoura/dto/BioLockDtos.java`
  - Migration script:
    - `backend/docs/migrations/biolock.sql`
- **Files to Modify:**
  - `backend/src/main/java/com/taskoura/entity/Project.java`: Add `@Column(name = "biolock_enabled") boolean bioLockEnabled`, `@ManyToOne @JoinColumn(name = "biolock_credential_id") BioLockCredential bioLockCredential`.
  - `backend/src/main/java/com/taskoura/entity/Attachment.java`: Add `@Column(name = "restricted", nullable = false) boolean restricted`.
  - `backend/src/main/java/com/taskoura/dto/AttachmentDtos.java`: Add `boolean restricted` to `AttachmentResponse`.

### Module BL-3: Device Channel (Backend)
- **Files to Create:**
  - `backend/src/main/java/com/taskoura/security/biolock/DeviceHmacAuthFilter.java` (HMAC-SHA256 signature verification over Method + Path + Timestamp + Nonce + BodyHash).
  - `backend/src/main/java/com/taskoura/security/biolock/DeviceKeyService.java` (Derives `deviceKey = HMAC-SHA256(DEVICE_MASTER_KEY, deviceId + ":" + keyVersion)`).
  - `backend/src/main/java/com/taskoura/service/BioLockJobService.java` (Job queue, lease acquisition, proof verification, outcome handling).
  - `backend/src/main/java/com/taskoura/controller/DeviceBioLockController.java` (`GET /api/device/biolock/jobs/next`, `POST /api/device/biolock/jobs/{jobId}/result`).
- **Files to Modify:**
  - `backend/src/main/java/com/taskoura/config/SecurityConfig.java`: Add dedicated `@Order(1)` device filter chain.
  - `backend/src/main/resources/application.properties`: Add default BioLock environment configuration keys.

### Module BL-4: Access Requests, Document Protection, Leader Email (Backend)
- **Files to Create:**
  - `backend/src/main/java/com/taskoura/service/BioLockAccessService.java` (Request submission, rate limiting, leader notification, access evaluation).
  - `backend/src/main/java/com/taskoura/controller/BioLockUserController.java` (`GET /api/biolock/status`, `POST /api/biolock/devices`, `POST /api/biolock/enrollment`, etc.).
  - `backend/src/main/resources/templates/email/biolock-access-request.html`.
- **Files to Modify:**
  - `backend/src/main/java/com/taskoura/controller/AttachmentController.java`: Add `PUT /api/attachments/{id}/restricted`, `POST /api/attachments/{id}/access-request`, `GET /api/attachments/{id}/access`, `POST /api/attachments/access-requests/{requestId}/cancel`, `GET /api/attachments/{id}/content`.
  - `backend/src/main/java/com/taskoura/service/EmailService.java`: Add `sendBioLockAccessRequestEmail` with throttling.
  - `backend/src/main/java/com/taskoura/controller/ProjectController.java`: Add `GET` and `PUT /api/projects/{projectId}/biolock`.

### Module BL-5: Project Creation & Task Documents UI (Frontend)
- **Files to Create:**
  - `frontend/src/services/biolockService.ts`
  - `frontend/src/hooks/useBioLock.ts`
  - `frontend/src/components/biolock/BioLockRequestModal.tsx`
  - `frontend/src/components/biolock/BioLockProjectToggle.tsx`
  - `frontend/src/types/biolock.ts`
- **Files to Modify:**
  - `frontend/src/types/project.ts` & `frontend/src/types/attachment.ts`: Add `bioLockEnabled`, `restricted`.
  - `frontend/src/lib/queryKeys.ts`: Add `biolock` query keys.
  - `frontend/src/components/projects/CreateProjectModal.tsx`: Add BioLock project protection toggle.
  - `frontend/src/features/attachments/components/AttachmentItem.jsx`: Add restriction toggle, lock badge, access request modal trigger, streaming preview.
  - `frontend/src/features/attachments/components/AttachmentsSection.jsx`: Render BioLock status banner.

### Module BL-6: Firmware Network Client & Simulator
- **Files to Create:**
  - `firmware/esp32/taskoura_biolock.ino` (ESP32-S2 WiFi, NTP, R307S UART, HMAC-SHA256 signing, polling loop).
  - `firmware/simulator/biolock_simulator.py` (Python PC simulator exercising HMAC signatures, job polling, proof generation, slot matching, and error outcomes).
  - `firmware/README.md`.

---

## 13. Project Risks & Open Clarification Questions

### Technical Risks
1. **Clock Skew on ESP32:** The HMAC protocol enforces `|serverTime - deviceTime| <= 120s`. The firmware MUST synchronize via NTP before making any API calls.
2. **Device Master Key Management:** If `DEVICE_MASTER_KEY` is rotated on the server, all previously registered devices will fail HMAC validation until re-registered or updated.
3. **Leaked Cloudinary URLs for Pre-existing Files:** Restricting a pre-existing file in Taskoura will not revoke the public Cloudinary CDN URL if someone previously copied it. Moving forward, restricted attachments must route through `/api/attachments/{id}/content`.
4. **Idempotency on Sensor Proofs:** Proof calculations must strictly match: `proof = hex(HMAC-SHA256(deviceKey, jobId + "|" + challenge + "|" + outcome + "|" + slotOrEmpty))`. Any mismatch in delimiters or slot formatting will fail authentication.

### Questions for Confirmation
1. For existing unrestricted attachments on an existing project, should `restricted` default to `false`? *(Recommended: Yes, default `false` so no existing files break).*
2. When a project leader enrolls their fingerprint via the hardware sensor, is each leader limited to 1 active credential per device, or multiple sensor slots? *(CONTRACT states `GET /api/biolock/status -> {credential:{id,status,slot}|null}`, implying 1 active credential per leader).*
3. When `GET /api/attachments/{id}/content` streams the file, should it forward Content-Type and Content-Disposition headers from the original attachment metadata? *(Recommended: Yes, preserving filename and MIME type).*
