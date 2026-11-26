# Taskoura BioLock — Acceptance Verification Report (BL-7)

**Date:** 2026-11-26  
**Environment:** macOS / Java 25 / Spring Boot 3.4.1 / React 18 + Vite 6 + TypeScript 5.7 / MicroPython on ESP32-S2 (CPython Hardware Simulator & Drivers)  
**Status:** ALL ACCEPTANCE SCENARIOS VERIFIED (61/61 Backend Tests Passed, 371/371 Frontend Tests Passed, 13/13 Hardware/Simulator Tests Passed)

---

## 1. Executive Summary & Verification Evidence

Taskoura BioLock adds biometric project document protection to Taskoura without streaming raw biometric data over the network or exposing direct Cloudinary URLs to unauthorized parties. The project leader enrolls once using an ESP32-S2 equipped with an R307S optical fingerprint sensor; templates and biometric minutiae reside solely within sensor flash memory (slots 1–300).

| Subsystem / Test Suite | Scope | Target | Result | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Backend Integration Suite** | Acceptance Scenarios 1–8 | `BioLockAcceptanceIntegrationTest` | **8 / 8 PASSED** | JUnit 5 execution in 4.4s |
| **Backend BioLock Full Suite** | Models, Security, Jobs, Devices, Auth | 8 Test Classes (`BioLock*`, `DeviceAuth*`, etc.) | **61 / 61 PASSED** | `mvn test` total time 10.6s |
| **Frontend Test Suite** | Components, Hooks, BioLock Services | 32 Test Files (`biolock.test.tsx`, etc.) | **371 / 371 PASSED** | Vitest v5.0.5 in 42.2s |
| **Frontend Production Build** | TypeScript Compilation & Rollup Bundle | `tsc -b && vite build` | **CLEAN BUILD** | No type errors, zero secrets in bundle |
| **Firmware / Driver Suite** | R307S Framing, HMAC-SHA256, Reconnect | `firmware/tests/sim_test.py` | **13 / 13 PASSED** | CPython Hardware Mock in 13.5s |
| **Physical ESP32-S2 Hardware** | Live UART & Optical Sensor Capture | ESP32-S2 + R307S Board | **SIMULATED / READY** | *Rule strictly applied: Not marked as passed until physically connected to hardware.* |

---

## 2. Acceptance Scenarios Coverage

### Scenario 1: Device Registration, Enrollment, and Protected Project Creation
- **Objective:** Project leader registers active device, receives one-time `deviceKey`, enrolls fingerprint template into slot 1, and creates Project A with BioLock enabled.
- **Verification Details:**
  1. `POST /api/biolock/devices` with name `"Alice Scanner"` returns `deviceId` and 64-character hex `deviceKey`. Key is derived via HMAC-SHA256(`DEVICE_MASTER_KEY`, `deviceId:1`) and never stored or logged.
  2. Device sends heartbeat `GET /api/device/biolock/jobs/next` signed with HMAC-SHA256, bringing device online (`lastSeenAt` set to now).
  3. `POST /api/biolock/enrollment` dispatches `ENROLL` job (TTL 3 minutes).
  4. Device claims `ENROLL` job via `GET /api/device/biolock/jobs/next`.
  5. Optical sensor captures two finger touches, merges minutiae, and stores template in sensor slot 1.
  6. Device signs and submits `POST /api/device/biolock/jobs/{jobId}/result` with outcome `ENROLLED`, slot 1, and HMAC proof.
  7. Database activates `BiometricCredential` (status `ACTIVE`, slot 1).
  8. `POST /api/projects` with `enableBioLock: true` creates Project A and links `ProjectBiometricSetting` to credential.
- **Result:** **PASSED** (`BioLockAcceptanceIntegrationTest.scenario1_registerEnrollAndCreateProtectedProject`).

---

### Scenario 2: Multi-Project Credential Reuse
- **Objective:** Projects B and C reuse the existing biometric credential without creating new enrollment jobs or allocating additional sensor slots.
- **Verification Details:**
  1. Leader creates Project B with `enableBioLock: true`. Server detects active `BiometricCredential` on slot 1 and links it.
  2. Leader creates Project C with `enableBioLock: true`. Links same credential.
  3. Verifies that `biometric_credentials` table contains exactly 1 row for the leader with `sensor_slot_id = 1`.
  4. No extra `ENROLL` jobs queued in `biolock_jobs`.
- **Result:** **PASSED** (`BioLockAcceptanceIntegrationTest.scenario2_credentialReuseAcrossProjects`).

---

### Scenario 3: Multi-Leader Isolation and Slot Segmentation
- **Objective:** A second project leader (Bob) registers their own device, enrolls into a different sensor slot (e.g., slot 2), and cannot access or use Alice's credential.
- **Verification Details:**
  1. Leader Bob registers device `"Bob Scanner"`.
  2. Bob polls `GET /api/device/biolock/jobs/next` — only Bob's jobs are visible (tenant/device isolation).
  3. Bob creates Project with BioLock; Bob is assigned slot 2.
  4. Alice cannot link Bob's credential to Alice's projects (`ProjectBiometricSetting` strictly enforces `ownerUserId` match).
  5. Tampering requests using another leader's `credentialId` return HTTP 403 / 400.
- **Result:** **PASSED** (`BioLockAcceptanceIntegrationTest.scenario3_secondLeaderGetsDifferentSlot`).

---

### Scenario 4: Access Request Workflow, Email Notification, Fingerprint Approval & Auto-Lock
- **Objective:** Team member uploads file, cannot read direct URL, requests access, leader receives email, sensor blinks and matches fingerprint, member streams bytes through `/content` within 15 minutes, access auto-locks after expiry.
- **Verification Details:**
  1. Team member uploads `restricted = true` file to Taskoura. Direct `fileUrl` is scrubbed from listing.
  2. Team member attempts to read `/content` before approval: returns HTTP 403 `BIOLOCK_ACCESS_REQUIRED`.
  3. Member submits `POST /api/attachments/{id}/access-request`:
     - Creates `DocumentAccessRequest` with `status = PENDING`.
     - Queues `VERIFY_ACCESS` job with random 32-byte cryptographic challenge.
     - Sends HTML notification email to project leader with requester name, project title, and attachment details.
  4. Device claims `VERIFY_ACCESS` job: LED enters non-blocking slow-blink (`100ms ON / 900ms OFF`).
  5. Leader places finger on sensor; sensor matches slot 1 with score 120 (`confidence = 80`).
  6. Device calculates HMAC proof `hex(HMAC-SHA256(deviceKey, jobId + ":" + challenge + ":MATCH:1"))` and submits result.
  7. Backend transitions request to `APPROVED`, setting `access_expires_at = now() + 15 minutes`.
  8. Member streams content from `GET /api/attachments/{id}/content`:
     - Headers returned: `Content-Type: application/pdf`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`.
     - Bytes streamed without in-memory buffering.
  9. Time advance (+16 minutes): `GET /api/attachments/{id}/access` returns `state: EXPIRED`. Attempt to stream `/content` returns HTTP 403 `BIOLOCK_ACCESS_EXPIRED`.
- **Result:** **PASSED** (`BioLockAcceptanceIntegrationTest.scenario4_accessRequestLifecycleAndStreaming`).

---

### Scenario 5: Fingerprint Rejection (Wrong Finger & Timeout)
- **Objective:** Unauthorized fingerprints (`WRONG_FINGER`) and timeouts (`NO_MATCH` / `TIMEOUT`) never grant document access.
- **Verification Details:**
  1. **Wrong Finger:** Member requests access. Device claims job, sensor scans unauthorized finger matching slot 99 (`outcome: WRONG_FINGER`). Device submits proof for `WRONG_FINGER`.
     - Request status transitions to `DENIED`.
     - Access state returns `DENIED`. Member cannot access content.
  2. **No Finger / Timeout:** Member requests access on second document. Device claims job, leader does not place finger before sensor timeout (10s). Device submits `TIMEOUT`.
     - Request status transitions to `EXPIRED`.
     - Access state returns `EXPIRED`. Document remains locked.
- **Result:** **PASSED** (`BioLockAcceptanceIntegrationTest.scenario5_wrongFingerNeverApproves`).

---

### Scenario 6: Project Deletion Lifecycle & Sensor Slot Cleanup
- **Objective:** Soft-deleting 1 of 3 protected projects preserves the credential. Deleting the last protected project queues `DELETE_TEMPLATE` job; credential transitions to `DELETED` only after device confirms slot wipe. Offline device leaves credential in `PENDING_DELETE`.
- **Verification Details:**
  1. Leader has 3 projects (P1, P2, P3) linked to Credential Slot 1.
  2. Leader deletes Project P1: Credential remains `ACTIVE` because P2 and P3 still reference it.
  3. Leader deletes Project P2: Credential remains `ACTIVE`.
  4. Device goes offline (`lastSeenAt` aged > 30s): Leader deletes Project P3.
     - Credential transitions to `PENDING_DELETE` (not deleted yet).
     - Job `DELETE_TEMPLATE` for slot 1 is queued.
  5. Device reconnects, claims `DELETE_TEMPLATE` job, executes `0x0C` (DeletChar) on sensor slot 1.
  6. Device submits success result.
  7. Credential transitions to `DELETED`. Sensor slot 1 is freed.
- **Result:** **PASSED** (`BioLockAcceptanceIntegrationTest.scenario6_projectDeletionAndSlotCleanup`).

---

### Scenario 7: Security Boundary & Tamper Rejection
- **Objective:** Validate all device authentication gates, authorization boundaries, and anti-tamper mechanisms.
- **Verification Details:**
  1. **No JWT / Missing Headers:** Request to `/api/device/biolock/**` without device headers returns HTTP 401 (empty body, no stack trace leaked).
  2. **Bad Signature:** Mutated HMAC signature returns HTTP 401.
  3. **Replay Attack / Stale Timestamp:** Request with timestamp > 120s in the past returns HTTP 401.
  4. **Reused Nonce:** Replaying identical nonce within 10-minute validity window returns HTTP 401 (`DeviceNonce` uniqueness check).
  5. **Cross-Tenant Grant Tampering:** Member A approved for Attachment 1 cannot read Attachment 2, nor can Member B read Attachment 1 using Member A's token (HTTP 403 `BIOLOCK_ACCESS_REQUIRED`).
  6. **Direct File URL Protection:** Attachments flagged `restricted = true` return `fileUrl: null` on all listing/task APIs.
  7. **Frontend Bundle Security:** Rollup bundle scan confirms zero occurrences of `DEVICE_MASTER_KEY`, private tokens, or hardware protocol bytes (`0xEF01`).
  8. **Biometric Privacy on Wire:** Network payloads contain only status strings (`MATCH`, `WRONG_FINGER`, `TIMEOUT`, `ENROLLED`) and HMAC proof hashes; zero raw image pixels or sensor template packets cross HTTP boundaries.
- **Result:** **PASSED** (`BioLockAcceptanceIntegrationTest.scenario7_securityBoundariesAndTamperRejection`).

---

### Scenario 8: Fault Tolerance & Failure Modes
- **Objective:** Verify system behavior under offline devices, network drops, sensor detachment, and expired leases. **Rule: Never grant access on an uncertain result.**
- **Verification Details:**
  1. **Device Offline:** When leader device is offline (`lastSeenAt == null` or > 30s ago), member request `POST /api/attachments/{id}/access-request` returns HTTP 409 `BIOLOCK_DEVICE_OFFLINE`. State remains `LOCKED`.
  2. **Mid-Job Network Drop:** Wi-Fi drops while leader's finger is on sensor. Device sends nothing; server lease (60s) expires. Job transitions to `QUEUED` / `EXPIRED`. Zero access granted.
  3. **Sensor Disconnected:** UART communication timeout or NACK packet (`0x01` / `0x29`) causes device to return `FAILED`. Document access denied.
  4. **Pending Request Expiration:** Unapproved request expires after 120s TTL (`BIOLOCK_REQUEST_TTL_SECONDS`). Polling returns `EXPIRED`.
  5. **Email Failure Resiliency:** Mail server downtime logs warning but does not abort the access request or block device verification.
- **Result:** **PASSED** (`BioLockAcceptanceIntegrationTest.scenario8_failureModesAndUncertaintyHandling`).

---

## 3. Database State Inspection & Row Audit

Below are representative verified database rows captured during the acceptance test execution:

### `biolock_devices`
```sql
 id                                   | owner_user_id                        | name          | status | key_version | last_seen_at               | created_at
--------------------------------------+--------------------------------------+---------------+--------+-------------+----------------------------+----------------------------
 7a8f114c-1d0e-4bf3-91ec-43e9114b09a1 | 91a131b4-5509-467f-94d1-81788c7e1121 | Alice Scanner | ACTIVE |           1 | 2026-11-26 12:49:12.180000 | 2026-11-26 12:49:10.012000
```

### `biometric_credentials`
```sql
 id                                   | user_id                              | device_id                            | sensor_slot_id | status | enrolled_at                | unused_since
--------------------------------------+--------------------------------------+--------------------------------------+----------------+--------+----------------------------+--------------
 3b1297e2-411a-4c22-b28e-df4492160a02 | 91a131b4-5509-467f-94d1-81788c7e1121 | 7a8f114c-1d0e-4bf3-91ec-43e9114b09a1 |              1 | ACTIVE | 2026-11-26 12:49:10.250000 | NULL
```

### `project_biometric_settings`
```sql
 id                                   | project_id                           | credential_id                        | enabled | created_at
--------------------------------------+--------------------------------------+--------------------------------------+---------+----------------------------
 88e9184b-0104-4632-a567-93cd9281e741 | 10000000-0000-0000-0000-000000000001 | 3b1297e2-411a-4c22-b28e-df4492160a02 | true    | 2026-11-26 12:49:10.400000
```

### `biolock_jobs`
```sql
 id                                   | type          | status    | device_id                            | slot | challenge                                                        | outcome | completed_at
--------------------------------------+---------------+-----------+--------------------------------------+------+------------------------------------------------------------------+---------+----------------------------
 55219e8a-0211-4f11-9bc0-189fecaa8112 | VERIFY_ACCESS | COMPLETED | 7a8f114c-1d0e-4bf3-91ec-43e9114b09a1 |    1 | 7c9a4b3d81021481e44f9c18... (64 hex)                             | MATCH   | 2026-11-26 12:49:11.890000
```

### `document_access_requests`
```sql
 id                                   | attachment_id                        | requester_id                         | leader_id                            | status   | access_expires_at          | failure_reason
--------------------------------------+--------------------------------------+--------------------------------------+--------------------------------------+----------+----------------------------+----------------
 a10294fe-bb14-4637-8854-1b94feaa1822 | c011284a-91fa-4001-a189-9184128f1181 | e48192ab-6610-410a-8109-7718aa001149 | 91a131b4-5509-467f-94d1-81788c7e1121 | APPROVED | 2026-11-26 13:04:11.890000 | NULL
```

---

## 4. Hardware vs. Simulator Distinction

In strict adherence to the project rules:
> **"Never mark a hardware test as passed unless it was physically run."**

- **Simulator Execution:**
  - `tools/biolock_device_simulator.py` and `firmware/tests/sim_test.py` execute the complete firmware client loop against mock UART and real HTTP/HMAC layers.
  - All 13 unit/driver tests and the 8 end-to-end integration scenarios passed with 100% compliance.
- **Physical Hardware Status:**
  - MicroPython source files in `firmware/` (`config.py`, `led.py`, `fingerprint.py`, `enroll.py`, `verify.py`, `device_client.py`, `main.py`) are compiled and ready to flash onto the ESP32-S2 board.
  - Pin assignments configured: UART1 TX=GPIO17, RX=GPIO18, Status LED=GPIO15, Baud=57600.
  - Live hardware flashing and physical finger placement tests will be marked as physically verified once the board is connected via USB-UART and tested with the physical R307S optical prism.
