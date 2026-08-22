# Taskoura — API Contract

**Base URL (local):** `http://localhost:8080/api`
**Base URL (production):** `https://taskoura-backend.onrender.com/api`

**Auth:** All endpoints except `POST /auth/register` and `POST /auth/login` require an `Authorization: Bearer <JWT>` header.

**Conventions:**
- All request/response bodies are JSON.
- Timestamps are ISO 8601 (`2026-08-22T10:30:00Z`).
- IDs are UUID strings.
- Standard error response shape:
```json
{ "error": "string", "message": "string", "status": 400 }
```

---

## 1. Authentication

### `POST /auth/register`
Create a new user account.

**Request**
```json
{ "name": "string", "email": "string", "password": "string" }
```
**Response `201`**
```json
{ "id": "uuid", "name": "string", "email": "string", "createdAt": "timestamp" }
```
**Errors:** `409` email already exists · `400` invalid input

---

### `POST /auth/login`
Authenticate and receive a JWT.

**Request**
```json
{ "email": "string", "password": "string" }
```
**Response `200`**
```json
{ "token": "jwt-string", "user": { "id": "uuid", "name": "string", "email": "string" } }
```
**Errors:** `401` invalid credentials

---

### `GET /users/me`
Get the authenticated user's profile.

**Response `200`**
```json
{ "id": "uuid", "name": "string", "email": "string", "createdAt": "timestamp" }
```

### `PUT /users/me`
Update the authenticated user's profile.

**Request**
```json
{ "name": "string" }
```
**Response `200`** — same shape as `GET /users/me`

---

## 2. Projects

### `POST /projects`
Create a new project. Caller becomes Project Owner automatically.

**Request**
```json
{
  "name": "string",
  "description": "string",
  "frontendStack": "string",
  "backendStack": "string",
  "databaseStack": "string",
  "testingStack": "string",
  "deadline": "date"
}
```
**Response `201`**
```json
{
  "id": "uuid", "name": "string", "description": "string",
  "ownerId": "uuid", "deadline": "date", "createdAt": "timestamp"
}
```

### `GET /projects`
List all projects the authenticated user is a member or owner of.

**Response `200`**
```json
[{ "id": "uuid", "name": "string", "role": "Owner|Member", "deadline": "date" }]
```

### `GET /projects/{projectId}`
Get full details of one project.

**Response `200`** — full Project object, plus `members: [{ userId, name, role }]`

### `PUT /projects/{projectId}`
Update project details. Owner only.

**Request** — same shape as create, all fields optional
**Response `200`** — updated Project object
**Errors:** `403` not the owner

### `DELETE /projects/{projectId}`
Delete a project. Owner only.

**Response `204`**

---

## 3. Project Members

### `POST /projects/{projectId}/members`
Invite a user to the project. Owner only.

**Request**
```json
{ "email": "string", "role": "Member" }
```
**Response `201`**
```json
{ "id": "uuid", "userId": "uuid", "projectId": "uuid", "role": "string" }
```
**Errors:** `404` user not found · `409` already a member

### `PUT /projects/{projectId}/members/{userId}`
Change a member's role. Owner only.

**Request**
```json
{ "role": "Owner|Member" }
```
**Response `200`** — updated membership object

### `DELETE /projects/{projectId}/members/{userId}`
Remove a member from the project. Owner only.

**Response `204`**

---

## 4. Tasks

### `POST /projects/{projectId}/tasks`
Create a task within a project.

**Request**
```json
{
  "title": "string",
  "description": "string",
  "category": "Frontend|Backend|Database|Testing|Documentation",
  "priority": "High|Medium|Low",
  "assignedTo": "uuid",
  "deadline": "date"
}
```
**Response `201`** — Task object with `status: "Backlog"` by default

### `GET /projects/{projectId}/tasks`
List all tasks in a project. Supports optional query params.

**Query params:** `?status=`, `?assignedTo=`, `?category=`, `?priority=`

**Response `200`**
```json
[{
  "id": "uuid", "title": "string", "category": "string", "priority": "string",
  "status": "string", "assignedTo": "uuid", "deadline": "date"
}]
```

### `GET /tasks/{taskId}`
Get full task details.

**Response `200`** — full Task object

### `PUT /tasks/{taskId}`
Update task fields (title, description, priority, deadline, assignee).

**Request** — any subset of task fields
**Response `200`** — updated Task object

### `PATCH /tasks/{taskId}/status`
Move a task to a new Kanban status. Automatically creates a `TaskStatusLog` entry server-side.

**Request**
```json
{ "status": "Backlog|InProgress|Testing|Completed" }
```
**Response `200`**
```json
{ "id": "uuid", "status": "string", "completedAt": "timestamp|null" }
```

### `DELETE /tasks/{taskId}`
Delete a task.

**Response `204`**

---

## 5. Comments

### `POST /tasks/{taskId}/comments`
**Request**
```json
{ "content": "string" }
```
**Response `201`**
```json
{ "id": "uuid", "taskId": "uuid", "userId": "uuid", "content": "string", "createdAt": "timestamp" }
```

### `GET /tasks/{taskId}/comments`
**Response `200`** — array of Comment objects

---

## 6. Attachments

### `POST /tasks/{taskId}/attachments`
Multipart upload; backend forwards the file to Cloudinary/S3 and stores the resulting URL.

**Request:** `multipart/form-data` with a `file` field
**Response `201`**
```json
{ "id": "uuid", "taskId": "uuid", "fileUrl": "string", "fileType": "string", "uploadedAt": "timestamp" }
```

### `GET /tasks/{taskId}/attachments`
**Response `200`** — array of Attachment objects

---

## 7. Notifications

### `GET /notifications`
List notifications for the authenticated user.

**Query params:** `?unreadOnly=true`

**Response `200`**
```json
[{ "id": "uuid", "message": "string", "isRead": false, "createdAt": "timestamp" }]
```

### `PATCH /notifications/{notificationId}/read`
Mark a notification as read.

**Response `200`**
```json
{ "id": "uuid", "isRead": true }
```

---

## 8. Activity Log

### `GET /projects/{projectId}/activity`
**Response `200`**
```json
[{
  "id": "uuid", "userId": "uuid", "actionType": "string",
  "description": "string", "createdAt": "timestamp"
}]
```

---

## 9. Dashboard

### `GET /projects/{projectId}/dashboard`
**Response `200`**
```json
{
  "totalTasks": 0,
  "completedTasks": 0,
  "completionPercentage": 0,
  "tasksByStatus": { "Backlog": 0, "InProgress": 0, "Testing": 0, "Completed": 0 },
  "tasksByMember": [{ "userId": "uuid", "name": "string", "assigned": 0, "completed": 0 }],
  "upcomingDeadlines": [{ "taskId": "uuid", "title": "string", "deadline": "date" }]
}
```

---

## 10. AI Features (Grok Integration)

All AI endpoints call the backend's `AiTaskService`, never the Grok API directly from the client.

### `POST /ai/test-cases`
Generate structured test cases for a task.

**Request**
```json
{ "taskId": "uuid" }
```
**Response `200`**
```json
{
  "testCases": [
    { "title": "string", "expectedResult": "string" }
  ]
}
```
**Errors:** `502` Grok API unavailable — client should show a fallback message, not crash

### `POST /ai/project-plan`
Generate a full module/task breakdown. Does **not** create tasks — returns a preview for the user to confirm.

**Request**
```json
{ "projectId": "uuid" }
```
**Response `200`**
```json
{
  "modules": [
    {
      "name": "string",
      "tasks": [{ "title": "string", "category": "string", "priority": "string" }]
    }
  ]
}
```

### `POST /ai/project-plan/confirm`
Bulk-create tasks from a previously generated (and now user-approved) plan.

**Request** — same `modules` shape as the generate response above, plus `projectId`
**Response `201`**
```json
{ "createdCount": 0, "taskIds": ["uuid"] }
```

### `GET /ai/next-task/{projectId}`
Get an AI recommendation for what to prioritize next.

**Response `200`**
```json
{ "recommendation": "string", "relatedTaskId": "uuid|null" }
```

---

## 11. Reports

### `GET /projects/{projectId}/report`
Generate the end-of-project performance report, one entry per member. Owner only.

**Response `200`**
```json
{
  "members": [
    {
      "userId": "uuid",
      "name": "string",
      "tasksAssigned": 0,
      "tasksCompleted": 0,
      "onTimeCompletions": 0,
      "lateCompletions": 0,
      "averageDelayDays": 0,
      "reworkCount": 0,
      "bugsAssigned": 0,
      "bugsFixed": 0,
      "avgBugTurnaroundHours": 0,
      "testCasesExecuted": 0,
      "testCasesPassed": 0,
      "aiSummary": "string"
    }
  ]
}
```

---

## 12. Bugs

### `POST /tasks/{taskId}/bugs`
**Request**
```json
{ "severity": "Low|Medium|High|Critical", "description": "string", "assignedTo": "uuid" }
```
**Response `201`** — Bug object with `status: "Open"`

### `PATCH /bugs/{bugId}/resolve`
**Response `200`**
```json
{ "id": "uuid", "status": "Resolved", "resolvedAt": "timestamp" }
```

### `GET /tasks/{taskId}/bugs`
**Response `200`** — array of Bug objects

---

## 13. Test Cases (execution results)

### `POST /tasks/{taskId}/test-cases`
Save execution result for a (possibly AI-generated) test case.

**Request**
```json
{ "description": "string", "expectedResult": "string", "passed": true }
```
**Response `201`** — TestCase object

### `GET /tasks/{taskId}/test-cases`
**Response `200`** — array of TestCase objects
