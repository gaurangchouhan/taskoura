# Taskoura — API Specification & Architecture Guide

## 1. Global Conventions

### Base URL
- **Local Development:** `http://localhost:8080/api`
- **Production:** `https://taskoura-backend.onrender.com/api`

### Time & Date Formats (Phase 0A)
- **Date-Time:** Every date-time in every JSON response is formatted in **UTC** adhering to ISO-8601 and ending with `"Z"` (for example, `"2026-10-21T09:15:30.123Z"`).
- **Date:** Dates remain `"YYYY-MM-DD"`.
- **Server Timezone:** JVM default timezone is initialized to `UTC` at application startup (`TimeZone.setDefault(TimeZone.getTimeZone("UTC"))`). Container images specify `ENV TZ=UTC`.
- **Historical Rows:** Database rows persisted prior to Phase 0A on developer workstations may have captured local time offsets; all newly persisted or serialized timestamps are strictly UTC.

---

## 2. Authentication & Security (Phase 0A)

- All endpoints under `/api/**` require an `Authorization: Bearer <JWT>` header, **except**:
  - `GET /api/health`
  - `POST /api/auth/**`
  - `GET /api/attachments/{attachmentId}/download`
- **Missing or Invalid Token:** Returns HTTP **401 Unauthorized** with error code `UNAUTHENTICATED`.
- **Insufficient Permissions:** Returns HTTP **403 Forbidden** with error code `FORBIDDEN`.
- **JWT Principal:** The authenticated user's email address.

---

## 3. Standard Error Format (Phase 0A)

All error responses return a consistent JSON body with the following structure:

```json
{
  "status": 409,
  "error": "Conflict",
  "code": "CONFLICT",
  "message": "Project with name already exists",
  "timestamp": "2026-10-24T18:09:51.631815Z",
  "path": "/api/projects"
}
```

### Validation Errors (`fieldErrors`)
For validation failures (HTTP 400), a `fieldErrors` map is included:

```json
{
  "status": 400,
  "error": "Bad Request",
  "code": "VALIDATION_FAILED",
  "message": "Title is required",
  "timestamp": "2026-10-24T18:10:00.123456Z",
  "path": "/api/projects/123/tasks",
  "fieldErrors": {
    "title": "Title is required"
  }
}
```

### Standard Error Codes
| Code | HTTP Status | Description |
|---|---|---|
| `VALIDATION_FAILED` | 400 | Invalid payload, missing required fields, or validation constraint violations. |
| `UNAUTHENTICATED` | 401 | Missing, malformed, or invalid JWT token. |
| `SESSION_EXPIRED` | 401 | Expired session or JWT token. |
| `FORBIDDEN` | 403 | Authenticated user lacks permission to access or modify the requested resource. |
| `NOT_FOUND` | 404 | Project, task, user, or entity not found. |
| `CONFLICT` | 409 | Duplicate entity or invalid state transition (e.g. task lifecycle conflicts). |
| `RATE_LIMITED` | 429 | Rate limit reached. |
| `EMAIL_DELIVERY_FAILED` | 500 | SMTP delivery error. |
| `AI_UNAVAILABLE` | 502 | Upstream AI service (Groq) or cloud storage error. |
| `INTERNAL` | 500 | Unexpected server error. Never leaks stack traces in response. |

---

## 4. Project Access Guard (`ProjectAccessService`)

`ProjectAccessService` provides centralized server-side authorization:
- `requireMember(UUID projectId, String email)`: Ensures the caller is an Owner or Member. Throws 404 if project is missing, 403 if user is not a member.
- `requireOwner(UUID projectId, String email)`: Ensures the caller is an Owner. Throws 404 if project is missing, 403 if user is a regular member or outsider.
- `requireTaskAccess(UUID taskId, String email)`: Resolves the task's project and enforces membership. Throws 404 if task or project is missing, 403 if outsider.
- `requireBugAccess(UUID bugId, String email)`: Resolves the bug's task and project, enforcing membership. Throws 404 if bug or task is missing, 403 if outsider.
- `getRole(UUID projectId, String email)` / `findRole(UUID projectId, String email)`: Membership lookup returning `"Owner"`, `"Member"`, or `null` / `Optional.empty()`.
- **Legacy Compatibility:** Direct project owners (`project.getOwner()`) count as `"Owner"` even if no row exists in `project_members`.
- **Project Membership & Role Attribute:** `GET /api/projects` returns all projects the caller owns OR is an invited member of (without duplicates). Each item contains an optional field `"role"` (`"Owner"` or `"Member"`).

---

## 5. Endpoints Reference & Access Matrix

| Endpoint | Method | Access Level | Description |
|---|---|---|---|
| `/api/auth/**` | POST | Public | Authentication & password recovery |
| `/api/health` | GET | Public | Health check |
| `/api/users/me` | GET, PUT | Authenticated | Own profile |
| `/api/projects` | GET | Authenticated | Projects owned OR joined as member (`role: Owner/Member`) |
| `/api/projects` | POST | Authenticated | Create project (creator becomes Owner) |
| `/api/projects/{projectId}` | GET | Member / Owner | Project details (`role: Owner/Member`) |
| `/api/projects/{projectId}` | PUT, DELETE | Owner only | Update or delete project |
| `/api/projects/{projectId}/members` | GET | Member / Owner | List project members |
| `/api/projects/{projectId}/members` | POST | Owner only | Invite member by email |
| `/api/projects/{projectId}/members/{userId}` | PUT | Owner only | Update member role |
| `/api/projects/{projectId}/members/{userId}` | DELETE | Owner only | Remove member |
| `/api/projects/{projectId}/tasks` | GET, POST | Member / Owner | List and create tasks |
| `/api/tasks/{taskId}` | GET, PUT, PATCH, DELETE | Member / Owner | Task operations |
| `/api/tasks/{taskId}/status` | PATCH | Member / Owner | Update task status |
| `/api/tasks/{taskId}/status-logs` | GET | Member / Owner | Task status transition history |
| `/api/tasks/{taskId}/assign` | PATCH | Member / Owner | Reassign task |
| `/api/tasks/{taskId}/subtasks` | GET, POST | Member / Owner | List and create subtasks |
| `/api/tasks/{taskId}/comments` | GET, POST | Member / Owner | List and add comments |
| `/api/tasks/{taskId}/attachments` | GET, POST | Member / Owner | List and upload attachments |
| `/api/attachments/{attachmentId}/download` | GET | Public | Binary stream download |
| `/api/attachments/{attachmentId}` | DELETE | Authenticated | Uploader or Project Owner only |
| `/api/tasks/{taskId}/bugs` | GET, POST | Member / Owner | List and file bugs |
| `/api/bugs/{bugId}/resolve` | PATCH | Member / Owner | Resolve bug |
| `/api/tasks/{taskId}/test-cases` | GET, POST | Member / Owner | List and create test cases |
| `/api/projects/{projectId}/dashboard` | GET | Member / Owner | Project dashboard metrics |
| `/api/projects/{projectId}/report` | GET | Owner only | End-of-project performance report |
| `/api/projects/{projectId}/calendar` | GET | Member / Owner | Monthly task calendar |
| `/api/projects/{projectId}/deadlines/upcoming` | GET | Member / Owner | Upcoming deadlines |
| `/api/templates` | GET | Authenticated | Available starter templates |
| `/api/projects/{projectId}/templates/{key}/apply` | POST | Member / Owner | Apply template to project |
| `/api/ai/test-cases` | POST | Member / Owner | AI test case generation (task access) |
| `/api/ai/project-plan` | POST | Member / Owner | AI project breakdown preview |
| `/api/ai/project-plan/confirm` | POST | Member / Owner | Confirm and materialize AI plan |
| `/api/ai/next-task/{projectId}` | GET | Member / Owner | AI next task recommendation |
| `/api/notifications` | GET | Authenticated | User's own notifications |
| `/api/notifications/{id}/read` | PATCH | Authenticated | Mark user's notification as read |
| `/api/projects/{projectId}/activity` | GET | Member / Owner | Project activity feed |

---

## 6. Retention & Soft Deletion Policy

Taskoura enforces a non-destructive soft-deletion model for projects and tasks:

1. **Entity Soft Deletion:**
   - Projects and Tasks utilize Hibernate `@SQLDelete` (marking `deleted_at = now()`) and `@SQLRestriction("deleted_at IS NULL")`.
   - `deletedAt` (`deleted_at`) and `deletedBy` (`deleted_by`) track when and by whom an entity was soft-deleted.

2. **Cascade Scope (Single Transaction):**
   - When a project is deleted (`DELETE /api/projects/{projectId}` by the project Owner):
     - The project is soft-deleted.
     - All tasks and subtasks belonging to that project are soft-deleted via a bulk update.
   - Associated child entities—including `ProjectMember`, `Comment`, `Bug`, `TestCase`, `Attachment`, `TaskStatusLog`, and `ActivityLog` rows—are retained in the database but effectively hidden through their parent entity's deletion.
   - Cloudinary uploaded files and assets are retained in cloud storage (never automatically deleted).
   - Historical notifications mentioning deleted projects or tasks are retained and do not break.

3. **API Visibility:**
   - Deleted projects are omitted from `GET /api/projects` for everyone (owners, members, and outsiders).
   - Every endpoint under a deleted project returns HTTP `404 Not Found` (including `/tasks`, `/members`, `/dashboard`, `/calendar`, `/report`, `/activity`, `/templates/.../apply`, and `/ai/...`).
   - Every endpoint under a deleted task returns HTTP `404 Not Found` (including `/subtasks`, `/comments`, `/bugs`, `/test-cases`, `/attachments`, `/status`, and `/status-logs`).
   - `DELETE /api/projects/{projectId}` returns `204 No Content` on initial deletion, and `404 Not Found` if called again or if the project does not exist. Non-owners receive `403 Forbidden` on existing projects.

4. **Purge Policy:**
   - Deleted projects and tasks are hidden from API consumers but retained in the database.
   - Permanent hard purge is not implemented, and no background purge job is scheduled or run.

