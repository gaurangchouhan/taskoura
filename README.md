# Taskoura

[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Spring Security](https://img.shields.io/badge/Security-Spring%20Security%20%2B%20JWT-red.svg)](https://spring.io/projects/spring-security)
[![Tests](https://img.shields.io/badge/Tests-240%20Passed-success.svg)](backend/src/test)

A robust, enterprise-grade project management and collaboration platform engineered for software development teams and students. Taskoura blends industry-standard Agile workflows—Kanban boards, subtasks, role-based team management, QA test case execution, cloud attachments, and analytics—with AI-assisted project planning powered by the xAI Grok API.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Core Features & Modules (1–16)](#core-features--modules-116)
- [Tech Stack](#tech-stack)
- [Database Schema (PostgreSQL)](#database-schema-postgresql)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Database Setup](#database-setup)
  - [Running the Backend](#running-the-backend)
  - [Running Tests](#running-tests)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Project Structure](#project-structure)

---

## Overview & Architecture

Taskoura provides a clean separation of concerns using a layered architectural model:

```
┌─────────────────────────────────────────────────────────┐
│                      Client Layer                       │
│           (React / Vite Frontend, Postman, Web)         │
└────────────────────────────┬────────────────────────────┘
                             │ HTTP / JSON / JWT
┌────────────────────────────▼────────────────────────────┐
│                    Controller Layer                     │
│         REST Endpoints, DTO Validation, Security        │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                      Service Layer                      │
│     Business Logic, Role Checks, AI & Cloud Services    │
│        (GrokClient, Cloudinary, Email, Deadline)        │
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                   Data Access Layer                     │
│               Spring Data JPA & Hibernate               │
└────────────────────────────┬────────────────────────────┘
                             │ JDBC
┌────────────────────────────▼────────────────────────────┐
│                   PostgreSQL Database                   │
│          Tables, Indexes, Foreign Key Constraints       │
└─────────────────────────────────────────────────────────┘
```

---

## Core Features & Modules (1–16)

Taskoura has been developed across 16 cohesive, fully tested modules:

1. **User Authentication & Authorization (Module 1)**: Stateless JWT token-based authentication, user registration, encrypted credentials using BCrypt.
2. **Email Verification & OTP Flow (Module 2)**: 4-digit one-time password (OTP) delivery via SMTP, account activation, expiration enforcement, and resend mechanics.
3. **Project Management (Module 3)**: Full project lifecycle with technology stack definitions (Frontend, Backend, Database, Testing) and project deadlines.
4. **Team Collaboration & Role-Based Access Control (Module 4)**: Multi-member teams with strict RBAC: `Owner`, `Admin`, `Member`, and `Viewer`. Invitation system with email lookups and permission validation.
5. **Interactive Kanban Board & Status Audit Logs (Module 5)**: Configurable Kanban workflows (`Backlog`, `Todo`, `InProgress`, `InReview`, `Testing`, `Completed`) with automated transition logs (`TaskStatusLog`) tracking turnaround times.
6. **Task Discussions & Commenting (Module 6)**: Collaborative comment threads attached to individual tasks.
7. **Quality Assurance — Bugs & Test Cases (Module 7)**:
   - **Bug Tracking**: Log defects with severity levels (`Low`, `Medium`, `High`, `Critical`), priority, assignees, and resolution turnaround tracking.
   - **QA Test Cases**: Design and log manual or automated test execution results (`passed`, `expectedResult`, `executedBy`, `executedAt`).
8. **AI-Powered Task Breakdown (Module 8)**: Integration with the xAI Grok API to automatically decompose high-level user stories into structured engineering tasks with categories, priorities, and descriptions.
9. **Activity Feed & In-App Notifications (Module 9)**: Project-wide activity logs auditing task creations, status updates, member invitations, and targeted personal notifications.
10. **Dashboard Analytics & Executive Reports (Module 10)**:
    - Real-time project dashboard: task completion velocity, status distribution, and upcoming deadlines.
    - Owner-only performance report: per-member completion rates, rework counts (backward status transitions), on-time vs late ratios, and bug resolution turnaround.
11. **Task File Attachments (Module 11)**: Cloud-native file uploads powered by Cloudinary. Supports images, documents, and logs with metadata tracking.
12. **Calendar & Upcoming Deadlines (Module 12)**: Visual agenda grouped by deadline dates with month filtering and an upcoming critical deadline monitor (`withinDays`).
13. **Curated Project Templates (Module 13)**: Pre-configured industry templates (e.g. *Library Management System*, *Hospital Management System*, *E-Commerce Platform*, etc.) to bootstrap realistic sprints in seconds.
14. **Parent/Child Subtask Hierarchies (Module 14)**: Nested subtasks belonging to parent tasks with single-level nesting safety constraints and parent progress rollup.
15. **In-Comment @Mentions & Deadline Monitoring (Module 15)**: Dynamic `@user` scanning in comments generating targeted alerts, alongside automated deadline notifications for approaching deliverables.
16. **User Profile & Self-Service Password Reset (Module 16)**: Authenticated profile management and secure, anti-enumeration password reset flow using isolated reset OTPs.

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Backend** | Java 21 / Spring Boot 3.4.x | REST API, Spring Data JPA, Spring Security, Validation |
| **Database** | PostgreSQL 16 | Relational schema, foreign keys, indexes |
| **Authentication** | Spring Security + JWT | Stateless bearer tokens, BCrypt hashing |
| **AI Integration** | xAI Grok API | Automated task generation and breakdown |
| **Cloud Storage** | Cloudinary SDK | Cloud file attachments |
| **Mail Service** | Spring Mail (JavaMailSender) | Verification codes and password reset OTPs |
| **Testing** | JUnit 5, Mockito, AssertJ, Spring Test | 240 automated unit, slice, and integration tests |
| **Build Tool** | Apache Maven | Build management and dependency resolution |

---

## Database Schema (PostgreSQL)

Taskoura runs with the following normalized relations:

- **`users`**: User identities, credentials, verification state, and reset tokens.
- **`projects`**: Project details, tech stack definitions, owner reference, deadlines.
- **`project_members`**: Membership mapping with assigned roles (`Owner`, `Admin`, `Member`, `Viewer`).
- **`tasks`**: Kanban task cards, priority, category, deadline, assignee, and parent task reference (for subtasks).
- **`task_status_logs`**: Historical audit log of every task status transition.
- **`comments`**: Comment threads linked to tasks with author attribution.
- **`attachments`**: Cloudinary URLs, file metadata, and task associations.
- **`bugs`**: Defect tracker linked to projects, reporters, and assignees.
- **`test_cases`**: QA test execution records and pass/fail states.
- **`notifications`**: Targeted user notifications with read/unread statuses.
- **`activity_logs`**: Project-wide audit trail of events.

---

## API Reference

### 1. Authentication & Profile
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new user | No |
| `POST` | `/api/auth/verify-otp` | Verify account via 4-digit email OTP | No |
| `POST` | `/api/auth/resend-otp` | Resend verification OTP | No |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | No |
| `POST` | `/api/auth/forgot-password` | Request password reset OTP | No |
| `POST` | `/api/auth/reset-password` | Reset password using verified reset OTP | No |
| `GET` | `/api/users/me` | Fetch authenticated user profile | Yes |
| `PUT` | `/api/users/me` | Update authenticated user profile | Yes |

### 2. Projects & Team Members
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/projects` | Create a new project | Yes |
| `GET` | `/api/projects` | List projects user belongs to | Yes |
| `GET` | `/api/projects/{id}` | Get project details | Yes |
| `PUT` | `/api/projects/{id}` | Update project details (Owner/Admin) | Yes |
| `DELETE` | `/api/projects/{id}` | Delete project (Owner only) | Yes |
| `GET` | `/api/projects/{id}/members` | List project members | Yes |
| `POST` | `/api/projects/{id}/members` | Invite new project member | Yes |
| `DELETE` | `/api/projects/{id}/members/{userId}` | Remove member from project | Yes |

### 3. Tasks, Subtasks & Kanban
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/projects/{projectId}/tasks` | Create task in project | Yes |
| `GET` | `/api/projects/{projectId}/tasks` | List tasks in project (with subtask counts) | Yes |
| `GET` | `/api/tasks/{id}` | Get task details | Yes |
| `PATCH` | `/api/tasks/{id}/status` | Update task Kanban status | Yes |
| `PUT` | `/api/tasks/{id}` | Edit task details | Yes |
| `DELETE` | `/api/tasks/{id}` | Delete task | Yes |
| `POST` | `/api/tasks/{parentTaskId}/subtasks` | Create child subtask under parent | Yes |
| `GET` | `/api/tasks/{parentTaskId}/subtasks` | List subtasks for parent task | Yes |

### 4. QA — Bugs & Test Cases
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/projects/{projectId}/bugs` | Log a new bug | Yes |
| `GET` | `/api/projects/{projectId}/bugs` | List bugs in project | Yes |
| `PATCH` | `/api/bugs/{id}/status` | Update bug status | Yes |
| `POST` | `/api/projects/{projectId}/test-cases` | Record a QA test case execution | Yes |
| `GET` | `/api/projects/{projectId}/test-cases` | List project test cases | Yes |

### 5. Attachments, Calendar, Templates & Analytics
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/tasks/{taskId}/attachments` | Upload file attachment (Cloudinary) | Yes |
| `GET` | `/api/tasks/{taskId}/attachments` | List attachments for a task | Yes |
| `GET` | `/api/projects/{projectId}/calendar` | Monthly calendar grouped by deadline | Yes |
| `GET` | `/api/projects/{projectId}/deadlines/upcoming` | Tasks due within N days | Yes |
| `GET` | `/api/templates` | List pre-populated project templates | Yes |
| `POST` | `/api/projects/from-template` | Create project initialized from template | Yes |
| `POST` | `/api/projects/{projectId}/ai-tasks` | Generate tasks from user story via Grok | Yes |
| `GET` | `/api/projects/{projectId}/dashboard` | Sprint and status analytics summary | Yes |
| `GET` | `/api/projects/{projectId}/report` | Executive per-member report (Owner only) | Yes |
| `GET` | `/api/notifications` | Current user notifications | Yes |
| `PATCH` | `/api/notifications/{id}/read` | Mark notification as read | Yes |
| `GET` | `/api/projects/{projectId}/activity` | Project audit activity log | Yes |

---

## Environment Variables

Configure these in your environment or in `backend/src/main/resources/application.properties`:

| Variable | Description | Default / Example |
|---|---|---|
| `DB_HOST` | PostgreSQL hostname | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `taskoura` |
| `DB_USERNAME` | Database username | `taskoura_user` |
| `DB_PASSWORD` | Database password | `taskoura_pass` |
| `JWT_SECRET` | Secret key for signing JWTs | `a-minimum-256-bit-secure-secret-key` |
| `JWT_EXPIRATION_MS` | JWT token validity (milliseconds) | `86400000` (24 hours) |
| `GROK_API_KEY` | xAI Grok API key | `xai-...` |
| `GROK_API_URL` | xAI Grok completions endpoint | `https://api.x.ai/v1/chat/completions` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account cloud name | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `your_api_key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `your_api_secret` |
| `MAIL_USERNAME` | SMTP Mail sender address | `notifications@yourdomain.com` |
| `MAIL_PASSWORD` | SMTP Mail app password | `app_password` |
| `OTP_EXPIRY_MINUTES` | Expiration window for OTPs | `10` |

---

## Getting Started

### Prerequisites
- **Java 21 (LTS)**
- **Maven 3.9+** (or use bundled wrapper)
- **PostgreSQL 15+** running locally or in Docker

---

### Database Setup

Log into PostgreSQL and initialize the database and user:

```sql
CREATE USER taskoura_user WITH PASSWORD 'taskoura_pass';
CREATE DATABASE taskoura OWNER taskoura_user;
GRANT ALL PRIVILEGES ON DATABASE taskoura TO taskoura_user;
```

---

### Running the Backend

From the repository root:

```bash
cd backend
mvn spring-boot:run
```

The application will start on `http://localhost:8080`.
The database tables will automatically synchronize via Hibernate (`ddl-auto=update`).

---

### Running Tests

Execute the complete automated test suite (240 tests across all 16 modules):

```bash
cd backend
mvn test
```

To run a specific test class:
```bash
mvn test -Dtest=ProfileAndResetPasswordIntegrationTest
```

To view HTML/text execution reports after running tests:
```bash
open target/surefire-reports/
```

---

## Testing & Quality Assurance

Taskoura adheres to strict testing standards:
- **Unit Tests**: Business logic tested in isolation with Mockito.
- **WebMvc Slice Tests**: HTTP controllers verified for security barriers, status codes, and JSON serialization.
- **JPA Repository Tests**: Schema mapping and custom SQL/JPQL queries verified.
- **Integration Tests**: Full Spring context (`@SpringBootTest`) end-to-end user journeys executed against PostgreSQL with transaction rollbacks.

```text
Results:
Tests run: 240, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

---

## Project Structure

```text
taskoura/
├── backend/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/taskoura/
│   │   │   │   ├── config/          # Security, CORS, Cloudinary configs
│   │   │   │   ├── controller/      # REST API Controllers (15 controllers)
│   │   │   │   ├── dto/             # Request & Response records
│   │   │   │   ├── entity/          # JPA Entities (User, Task, Project, etc.)
│   │   │   │   ├── exception/       # GlobalExceptionHandler & custom exceptions
│   │   │   │   ├── repository/      # Spring Data JPA Repositories
│   │   │   │   ├── security/        # JWT Filter, Token Provider
│   │   │   │   └── service/         # Business logic & integrations
│   │   │   └── resources/
│   │   │       ├── application.properties
│   │   │       └── schema.sql
│   │   └── test/                    # 240 automated test cases (Unit, Web, Integration)
│   └── pom.xml                      # Maven dependencies and build plugins
├── docs/                            # SRS, API contract, and ER architecture diagrams
├── frontend/                        # React / Vite application
└── README.md                        # Documentation
```
