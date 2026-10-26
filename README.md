# Taskoura

[![Java](https://img.shields.io/badge/Java-21-orange.svg)](https://www.oracle.com/java/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.1-brightgreen.svg)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18.3-61dafb.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.1-646cff.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4-38b2ac.svg)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://www.postgresql.org/)
[![Vitest](https://img.shields.io/badge/Vitest-315%20Passed-success.svg)](frontend/src/test)
[![JUnit5](https://img.shields.io/badge/JUnit5-Backend%20Tests-success.svg)](backend/src/test)

A modern, enterprise-grade project management, team collaboration, and quality assurance platform. Taskoura unifies industry-standard Agile workflows—interactive Kanban boards, hierarchical subtasks, role-based team management, QA test case execution, Cloudinary file attachments, and real-time analytical dashboards—with ultra-fast AI-assisted sprint planning powered by the Groq LPU inference engine.

---

## Table of Contents

- [Overview & Architecture](#overview--architecture)
- [Key Features](#key-features)
  - [Frontend Experience](#frontend-experience)
  - [Backend & Core Modules](#backend--core-modules)
- [Full-Stack Technology Stack](#full-stack-technology-stack)
- [Project Directory Structure](#project-directory-structure)
- [Database Schema (PostgreSQL)](#database-schema-postgresql)
- [REST API Reference](#rest-api-reference)
  - [1. Authentication & Profiles](#1-authentication--profiles)
  - [2. Projects & Team Members](#2-projects--team-members)
  - [3. Tasks, Subtasks & Kanban](#3-tasks-subtasks--kanban)
  - [4. Quality Assurance — Bugs & Test Cases](#4-quality-assurance--bugs--test-cases)
  - [5. Attachments, Calendar, Templates & Analytics](#5-attachments-calendar-templates--analytics)
- [Environment Configuration](#environment-configuration)
  - [Backend Environment Variables](#backend-environment-variables)
  - [Frontend Environment Variables](#frontend-environment-variables)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Database Setup](#1-database-setup)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
  - [4. Docker Deployment](#4-docker-deployment)
- [Testing & Quality Assurance](#testing--quality-assurance)
  - [Frontend Test Suite (Vitest)](#frontend-test-suite-vitest)
  - [Backend Test Suite (JUnit 5 & Mockito)](#backend-test-suite-junit-5--mockito)

---

## Overview & Architecture

Taskoura is architected with a decoupled, high-performance client-server model:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             Client Layer (Frontend)                              │
│   React 18 + TypeScript + Vite 6 + Tailwind CSS + Recharts + GSAP + TanStack Q.  │
│   • Interactive Kanban Board (@hello-pangea/dnd)                                 │
│   • Analytical Dashboards & Reports                                              │
│   • Multi-Tab Session Synchronization (BroadcastChannel)                        │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ HTTPS / REST JSON / Bearer JWT
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                           Security & Controller Layer                            │
│   Spring Boot 3.4 REST Controllers + Spring Security + JWT Authentication Filter │
│   • Stateless Bearer Token Verification                                          │
│   • ProjectAccessService RBAC Authorization (Owner, Admin, Member, Viewer)       │
│   • Global Exception Handler & Standardized RFC-7807 Error Responses             │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                                 Service Layer                                    │
│   • Task, Subtask & Status Transition Audit Engine                               │
│   • UserSession Management & Idle/Absolute Timeout Handlers                      │
│   • AI Task Planner (Groq Cloud LPU Client)                                      │
│   • Cloud File Attachment Storage (Cloudinary SDK)                               │
│   • Asynchronous Email & OTP Delivery (Thymeleaf Engine + JavaMailSender)        │
│   • Automated Daily Deadline Cron & Alert Dispatcher                             │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                            Data Persistence Layer                                │
│   Spring Data JPA + Hibernate ORM (HikariCP Connection Pool)                     │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ JDBC
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                              PostgreSQL Database                                 │
│   Normalized relational tables, foreign key cascades, and composite indexes      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Frontend Experience

- **Interactive Kanban Board**: Drag-and-drop workflow (`@hello-pangea/dnd`) across customizable columns (`Backlog`, `Todo`, `InProgress`, `InReview`, `Testing`, `Completed`) with real-time status change audit history, category pills, priority badges, and search/filter toolbars.
- **AI Task Decomposition**: Interactive modal interface allowing developers and leads to submit high-level user stories to the Groq AI service, preview decomposed tasks, edit them, and import them directly into the sprint.
- **QA & Testing Center**: Dedicated Quality tab within each project containing:
  - **Defect Tracker**: Bug logging, severity badges (`Low`, `Medium`, `High`, `Critical`), assignees, and resolution turnaround tracking.
  - **Test Case Execution**: Structured test suite records with expected results, pass/fail status updates, executor stamps, and pass-rate summaries.
- **Analytics & Executive Dashboards**: High-resolution data visualizations powered by Recharts:
  - Project velocity & overall completion percentage rings.
  - Status distribution donuts.
  - Per-member workload and task completion bars.
  - Critical upcoming deadline monitor with date countdowns.
- **Team Management & Role-Based Access Control**: Member invitations by email, role assignments (`Owner`, `Admin`, `Member`, `Viewer`), and permission-gated controls.
- **Task Discussions with @Mentions**: Contextual comment threads on every task card featuring live `@user` popover search and instant notifications for tagged team members.
- **Multi-File Cloud Attachments**: Direct drag-and-drop file uploads to Cloudinary with file previews, size validation, and download capabilities.
- **Session Security & Tab Synchronization**: Inactivity tracking with countdown warning modals and cross-tab synchronization via `BroadcastChannel` (logging out in one tab logs out all open tabs).
- **Cinematic Landing Page**: Smooth scroll-driven animation sequence powered by GSAP and dynamic blur dissolves.

### Backend & Core Modules

1. **User Authentication & Authorization (Module 1)**: Stateless JWT token issuance and validation, BCrypt password hashing, and role verification.
2. **Email Verification & Hardened OTP Flow (Module 2)**: 4-digit verification codes delivered via SMTP, salted pepper hashing at rest, rate limiting, and attempt thresholds.
3. **Project Management (Module 3)**: Complete project lifecycle, tech stack taxonomy (Frontend, Backend, Database, Testing), and sprint deadlines.
4. **Team Collaboration & RBAC (Module 4)**: Member mapping with strict permission barriers enforced at service and database levels.
5. **Kanban Status Engine & Audit Logs (Module 5)**: Transition tracking via `TaskStatusLog` recording stage turnaround times.
6. **Task Discussions & Commenting (Module 6)**: Threaded comments attached to individual tasks.
7. **Quality Assurance — Bugs & Test Cases (Module 7)**: Dual QA tracking for defects and automated/manual test case verification.
8. **AI-Powered Task Generation (Module 8)**: GroqCloud LPU integration for fast decomposition of epics into discrete engineering tickets.
9. **Activity Feed & Notifications (Module 9)**: Project-wide activity stream auditing all events, plus targeted personal notifications.
10. **Sprint Analytics & Owner Reports (Module 10)**: Real-time project summary metrics and owner-only performance audit reports.
11. **Cloudinary Attachment Storage (Module 11)**: Cloud-native multipart file handling with container-level and service-level file size checks.
12. **Calendar & Upcoming Deadlines (Module 12)**: Monthly agenda grouped by deadline dates with critical window (`withinDays`) queries.
13. **Curated Project Templates (Module 13)**: Pre-populated sprint templates (e.g., *E-Commerce*, *Hospital Management*, *Library Management*) for fast project scaffolding.
14. **Parent/Child Subtask Hierarchies (Module 14)**: Nested subtasks with parent completion percentage rollups and single-nesting safety guards.
15. **In-Comment @Mentions & Deadline Alerts (Module 15)**: Dynamic mention extraction triggering alerts, paired with scheduled deadline reminder jobs.
16. **User Profile & Anti-Enumeration Password Reset (Module 16)**: Authenticated user profiles (skills, bio, title, timezone) and secure password recovery via reset OTPs.

---

## Full-Stack Technology Stack

| Domain | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend Framework** | React | 18.3 | Component-based UI library |
| **Language (Frontend)** | TypeScript | 5.7 | Static type safety and strict schema validation |
| **Build & Dev Server** | Vite | 6.1 | Fast HMR dev server and optimized production bundler |
| **Styling & Design** | Tailwind CSS | 3.4 | Utility-first responsive styling and dark/light UI |
| **Drag and Drop** | @hello-pangea/dnd | 18.0 | Accessible Kanban column and card drag-and-drop |
| **State & Fetching** | @tanstack/react-query | 5.104 | Server-state caching, background revalidation |
| **HTTP Client** | Axios | 1.7 | Interceptors, Bearer token injection, automatic port failover |
| **Charts & Metrics** | Recharts | 3.10 | Responsive SVG analytical charts and rings |
| **Animations** | GSAP | 3.12 | Cinematic scroll-driven hero sequence |
| **Icons** | Lucide React | 0.475 | Vector icon set |
| **Frontend Testing** | Vitest + Testing Library | 5.0 / 16.3 | 28 test suites, 315 component and integration tests |
| **Backend Framework** | Spring Boot | 3.4.1 | Java REST API enterprise framework |
| **Language (Backend)** | Java | 21 (LTS) | Modern language features (Records, Pattern Matching) |
| **Security** | Spring Security + JJWT | 6.2 / 0.12 | Stateless JWT filter and BCrypt encryption |
| **Database** | PostgreSQL | 16 | Relational database with relational integrity |
| **ORM / Data Access** | Spring Data JPA / Hibernate | 6.6 | Schema synchronization, JPQL queries, transactions |
| **Email Engine** | Spring Mail + Thymeleaf | 3.4.1 | Multipart HTML/plain-text templated emails |
| **Cloud Storage** | Cloudinary Java SDK | 1.39 | Cloud-native asset storage and CDN delivery |
| **AI Inference** | Groq Cloud API | REST | Ultra-low latency LPU model inference |
| **Backend Testing** | JUnit 5 + Mockito + GreenMail | 5.x | Unit, slice, and integration test coverage |
| **Containerization** | Docker | Alpine JRE 21 | Containerized runtime environment |

---

## Project Directory Structure

```text
taskoura/
├── .gitignore                          # Root gitignore (excludes secrets, build artifacts, symlinks)
├── README.md                           # End-to-end documentation
├── backend/                            # Spring Boot Java 21 Backend
│   ├── Dockerfile                      # Production Docker container image
│   ├── pom.xml                         # Maven dependencies & plugins
│   ├── docs/
│   │   ├── API.md                      # Complete REST API specification & RFC-7807 error catalog
│   │   └── EMAIL.md                    # Email architecture, SMTP guides & local mail catchers
│   └── src/
│       ├── main/
│       │   ├── java/com/taskoura/
│       │   │   ├── BackendApplication.java
│       │   │   ├── config/         # Security, CORS, Async, Clock, Jackson configs
│       │   │   ├── controller/     # 15 REST API Controllers
│       │   │   ├── dto/            # Request and Response record DTOs
│       │   │   ├── entity/         # JPA Entities (User, Project, Task, Bug, TestCase, etc.)
│       │   │   ├── exception/      # GlobalExceptionHandler & custom exception classes
│       │   │   ├── repository/     # Spring Data JPA Repositories
│       │   │   ├── security/       # JwtAuthFilter, JwtUtil token provider
│       │   │   ├── service/        # Business logic & cloud integrations
│       │   │   └── validation/     # Custom Bean Validation constraints
│       │   └── resources/
│       │       ├── application.properties          # Base configuration with env placeholders
│       │       ├── application-local.properties    # Local overrides (gitignored)
│       │       ├── schema.sql                      # DDL schema definition
│       │       └── templates/                      # Thymeleaf responsive HTML email templates
│       └── test/                                   # 240+ JUnit 5 & Mockito test suites
├── frontend/                           # React 18 + TypeScript + Vite Frontend
│   ├── package.json                    # Dependencies, scripts, and dev tools
│   ├── vite.config.ts                  # Vite build configuration and test setup
│   ├── tailwind.config.js              # Tailwind theme and styling tokens
│   ├── index.html                      # Single Page Application entrypoint
│   ├── .env.example                    # Frontend environment configuration template
│   ├── public/
│   │   └── images/                     # Public assets and cinematic scroll frames
│   └── src/
│       ├── main.tsx                    # React DOM root and QueryClient provider
│       ├── App.tsx                     # React Router routes and ProtectedRoute boundaries
│       ├── index.css                   # Global styles and Tailwind directives
│       ├── components/
│       │   ├── activity/               # ActivityFeed components
│       │   ├── ai/                     # AiPlanModal, PlanPreview, AiTestCasesPanel
│       │   ├── auth/                   # OtpInput, SessionWarningModal
│       │   ├── comments/               # CommentsSection, CommentComposer, Mentions
│       │   ├── common/                 # Avatar, Buttons, Modals, Status Badges
│       │   ├── dashboard/              # CompletionRing, StatusDonut, MemberBars, StatCard
│       │   ├── members/                # InviteMemberForm, MemberRow
│       │   ├── notifications/          # NotificationBell, NotificationList drawer
│       │   ├── projects/               # CreateProjectModal, DeleteProjectModal
│       │   ├── quality/                # QualitySection, BugsTab, TestCasesTab, AddTestCaseForm
│       │   ├── tasks/                  # KanbanBoard, TaskCard, TaskPanel, StatusHistory
│       │   └── ScrollExperience.tsx    # GSAP cinematic scroll animation sequence
│       ├── context/
│       │   └── AuthContext.tsx         # User authentication, token lifecycle, broadcast channel
│       ├── hooks/                      # Custom React hooks (useTasks, useProjects, useAi, etc.)
│       ├── lib/                        # Utilities (errors, datetime, tokens, queryKeys, constants)
│       ├── pages/                      # Application views (Dashboard, ProjectBoard, Quality, etc.)
│       ├── routes/                     # ProtectedRoute and PublicOnlyRoute guards
│       ├── services/                   # Modular Axios API service integrations
│       ├── test/                       # 28 Vitest test suites (315 tests passing)
│       └── types/                      # TypeScript interfaces and domain types
└── docs/                               # System diagrams, specifications, and architecture notes
```

---

## Database Schema (PostgreSQL)

Taskoura runs on a normalized, production-grade schema:

```
  ┌──────────────┐       1:N       ┌──────────────┐
  │    users     ├────────────────►│ user_profiles│
  └──────┬───────┘                 └──────────────┘
         │
         │ 1:N
         ├────────────────────────►┌──────────────┐
         │                         │user_sessions │
         │                         └──────────────┘
         │ 1:N
         ├────────────────────────►┌──────────────┐
         │                         │projects      │◄──────────┐
         │                         └──────┬───────┘           │
         │ 1:N                            │ 1:N               │ 1:N
         ├─────────────►┌──────────────┐  ├──────────────►┌───┴──────────┐
         │              │project_member│◄─┘               │activity_logs │
         │              └──────────────┘                  └──────────────┘
         │ 1:N
         ├────────────────────────►┌──────────────┐
         │                         │tasks         │◄──────────┐
         │                         └──────┬───────┘           │
         │                                │ 1:N               │
         │ 1:N                            ├──────────────►┌───┴──────────┐
         ├─────────────►┌──────────────┐  │               │comments      │
         │              │task_status_log◄─┘               └──────────────┘
         │              └──────────────┘  │ 1:N
         │                                └──────────────►┌──────────────┐
         │ 1:N                                            │attachments   │
         ├────────────────────────►┌──────────────┐       └──────────────┘
         │                         │bugs          │
         │                         └──────────────┘
         │ 1:N
         ├────────────────────────►┌──────────────┐
         │                         │test_cases    │
         │                         └──────────────┘
         │ 1:N
         └────────────────────────►┌──────────────┐
                                   │notifications │
                                   └──────────────┘
```

- **`users`**: Core account identities, BCrypt passwords, verification state, and OTP timestamps.
- **`user_profiles`**: Extended developer profiles (bio, avatar URL, skills list, title, timezone).
- **`user_sessions`**: Tracks active login sessions, idle timeout markers, and user-agent strings.
- **`projects`**: Project workspace metadata, tech stack taxonomy, owner reference, deadlines.
- **`project_members`**: Membership mappings with roles (`Owner`, `Admin`, `Member`, `Viewer`).
- **`tasks`**: Kanban cards with category, priority, deadlines, assignees, and parent-child hierarchy.
- **`task_status_logs`**: Historical audit log capturing each stage transition and duration.
- **`comments`**: Task discussions supporting `@mention` parsing and author attribution.
- **`attachments`**: Cloudinary CDN URLs, file sizes, MIME types, and task linkages.
- **`bugs`**: Quality defect records with severity levels, priority, assignees, and resolution states.
- **`test_cases`**: QA test records containing expected results, pass/fail status, and executor stamps.
- **`notifications`**: Targeted user alerts with read/unread markers and contextual routing links.
- **`activity_logs`**: Project-wide chronological audit trail of all actions.

---

## REST API Reference

All protected endpoints require an `Authorization: Bearer <JWT>` header. Standardized error responses adhere to RFC-7807 (`status`, `error`, `code`, `message`, `timestamp`, `path`, and optional `fieldErrors`).

### 1. Authentication & Profiles
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register a new user account | No |
| `POST` | `/api/auth/verify-otp` | Activate account via 4-digit email OTP | No |
| `POST` | `/api/auth/resend-otp` | Request a new verification OTP | No |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT bearer token | No |
| `POST` | `/api/auth/logout` | Terminate active user session | Yes |
| `POST` | `/api/auth/forgot-password` | Request password reset OTP | No |
| `POST` | `/api/auth/reset-password` | Reset password using verified reset OTP | No |
| `GET` | `/api/users/me` | Fetch authenticated user profile & preferences | Yes |
| `PUT` | `/api/users/me` | Update authenticated user profile | Yes |

### 2. Projects & Team Members
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/projects` | Create a new project workspace | Yes |
| `GET` | `/api/projects` | List projects where user is a member | Yes |
| `GET` | `/api/projects/{id}` | Get project details and tech stack | Yes |
| `PUT` | `/api/projects/{id}` | Update project metadata (Owner/Admin) | Yes |
| `DELETE` | `/api/projects/{id}` | Delete project workspace (Owner only) | Yes |
| `GET` | `/api/projects/{id}/members` | List project team members & roles | Yes |
| `POST` | `/api/projects/{id}/members` | Invite new member by email with role | Yes |
| `PATCH` | `/api/projects/{id}/members/{userId}/role` | Change member role (Owner/Admin) | Yes |
| `DELETE` | `/api/projects/{id}/members/{userId}` | Remove member from project | Yes |

### 3. Tasks, Subtasks & Kanban
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/projects/{projectId}/tasks` | Create task in project | Yes |
| `GET` | `/api/projects/{projectId}/tasks` | List all project tasks with subtask counts | Yes |
| `GET` | `/api/tasks/{id}` | Get full task details and history | Yes |
| `PUT` | `/api/tasks/{id}` | Edit task attributes (title, priority, etc.) | Yes |
| `PATCH` | `/api/tasks/{id}/status` | Update Kanban status (triggers audit log) | Yes |
| `DELETE` | `/api/tasks/{id}` | Delete task and cascading attachments | Yes |
| `POST` | `/api/tasks/{parentTaskId}/subtasks` | Create child subtask | Yes |
| `GET` | `/api/tasks/{parentTaskId}/subtasks` | List all child subtasks | Yes |
| `POST` | `/api/tasks/{taskId}/comments` | Add comment (supports `@user` mentions) | Yes |
| `GET` | `/api/tasks/{taskId}/comments` | List task comment thread | Yes |

### 4. Quality Assurance — Bugs & Test Cases
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/projects/{projectId}/bugs` | Report a new defect | Yes |
| `GET` | `/api/projects/{projectId}/bugs` | List all bugs in project | Yes |
| `PATCH` | `/api/bugs/{id}/status` | Update bug lifecycle status | Yes |
| `POST` | `/api/projects/{projectId}/test-cases` | Create a QA test case specification | Yes |
| `GET` | `/api/projects/{projectId}/test-cases` | List all project test cases | Yes |
| `PATCH` | `/api/test-cases/{id}/execution` | Record test execution result (pass/fail) | Yes |

### 5. Attachments, Calendar, Templates & Analytics
| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/tasks/{taskId}/attachments` | Upload file attachment to Cloudinary | Yes |
| `GET` | `/api/tasks/{taskId}/attachments` | List attachments for task | Yes |
| `DELETE` | `/api/attachments/{id}` | Delete file attachment | Yes |
| `GET` | `/api/projects/{projectId}/calendar` | Monthly agenda grouped by deadline | Yes |
| `GET` | `/api/projects/{projectId}/deadlines/upcoming` | Deadlines due within N days | Yes |
| `GET` | `/api/templates` | Browse curated industry templates | Yes |
| `POST` | `/api/projects/from-template` | Initialize new project from template | Yes |
| `POST` | `/api/projects/{projectId}/ai-tasks` | Decompose user story via Groq LPU | Yes |
| `GET` | `/api/projects/{projectId}/dashboard` | Sprint velocity & status distribution | Yes |
| `GET` | `/api/projects/{projectId}/report` | Executive per-member report (Owner only) | Yes |
| `GET` | `/api/notifications` | Current user in-app notifications | Yes |
| `PATCH` | `/api/notifications/{id}/read` | Mark notification as read | Yes |
| `GET` | `/api/projects/{projectId}/activity` | Project audit event activity feed | Yes |

---

## Environment Configuration

### Backend Environment Variables

Configure these in your deployment platform or locally in `backend/application-local.properties` (which is gitignored):

| Variable | Description | Default / Example |
|---|---|---|
| `SERVER_PORT` / `PORT` | HTTP server listening port | `8081` (fallback `8080`) |
| `DB_URL` | JDBC connection string | `jdbc:postgresql://localhost:5432/taskoura` |
| `DB_USERNAME` | PostgreSQL database user | `taskoura_user` |
| `DB_PASSWORD` | PostgreSQL database password | `taskoura_pass` |
| `JWT_SECRET` | Secret key for HS256 JWT signing | `minimum-256-bit-secure-secret-key` |
| `JWT_EXPIRATION_MS` | JWT token validity window | `86400000` (24 hours) |
| `GROQ_API_KEY` | GroqCloud API key for AI task breakdown | `gsk_...` |
| `GROQ_MODEL` | Groq inference model | `openai/gpt-oss-20b` or `llama-3.3-70b-versatile` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud identifier | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `your_api_key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `your_api_secret` |
| `SPRING_MAIL_HOST` | SMTP server host | `smtp.gmail.com` (or `smtp-relay.brevo.com`) |
| `SPRING_MAIL_PORT` | SMTP server port | `587` (or `2525` on free cloud tiers) |
| `SPRING_MAIL_USERNAME` | SMTP account email address | `notifications@yourdomain.com` |
| `SPRING_MAIL_PASSWORD` | SMTP app password or API key | `app_password` |
| `MAIL_FROM` | Sender email address | `support@taskoura.dev` |
| `MAIL_FROM_NAME` | Display name for outgoing mail | `Taskoura` |
| `FRONTEND_URL` | Client URL for email activation links | `http://localhost:5173` |

### Frontend Environment Variables

Create a `frontend/.env.local` file for custom local frontend overrides:

| Variable | Description | Default / Example |
|---|---|---|
| `VITE_API_URL` | Backend REST API base URL | `http://localhost:8081` (auto-fails over to `8080`) |

---

## Getting Started

### Prerequisites

- **Java 21 (LTS)**: Required for the Spring Boot backend (`java -version`).
- **Maven 3.9+**: For building backend artifacts (`mvn -v`).
- **Node.js 18+ & npm**: For the Vite/React frontend (`node -v`).
- **PostgreSQL 15+**: Local service or Docker container.

---

### 1. Database Setup

Log into PostgreSQL and provision the database and user:

```sql
CREATE USER taskoura_user WITH PASSWORD 'taskoura_pass';
CREATE DATABASE taskoura OWNER taskoura_user;
GRANT ALL PRIVILEGES ON DATABASE taskoura TO taskoura_user;
```

---

### 2. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. *(Optional)* Create your local overrides file `application-local.properties` for your keys (this file is gitignored):
   ```properties
   groq.api.key=your_groq_api_key_here
   spring.mail.username=your_email@gmail.com
   spring.mail.password=your_gmail_app_password
   cloudinary.cloud-name=your_cloud_name
   cloudinary.api-key=your_api_key
   cloudinary.api-secret=your_api_secret
   ```

3. Launch the Spring Boot application:
   ```bash
   mvn spring-boot:run
   ```
   The backend will start on `http://localhost:8081` (or your configured port). Database tables will automatically synchronize via Hibernate (`ddl-auto=update`).

---

### 3. Frontend Setup

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`. The frontend automatically connects to the backend and handles API failover between ports `8081` and `8080`.

---

### 4. Docker Deployment

To containerize and run the backend using Docker:

```bash
cd backend
mvn clean package -DskipTests
docker build -t taskoura-backend .
docker run -p 8080:8080 \
  -e DB_URL=jdbc:postgresql://host.docker.internal:5432/taskoura \
  -e DB_USERNAME=taskoura_user \
  -e DB_PASSWORD=taskoura_pass \
  taskoura-backend
```

---

## Testing & Quality Assurance

Taskoura maintains comprehensive automated test suites across both layers of the application.

### Frontend Test Suite (Vitest)

The frontend features 28 test suites covering component rendering, routing guards, drag-and-drop state, session timeouts, and user flows using Vitest, React Testing Library, and MSW:

```bash
cd frontend
npm test
```

```text
 Test Files  28 passed (28)
      Tests  315 passed (315)
   Start at  01:39:15
   Duration  31.58s
```

To run a production build verification:
```bash
npm run build
```

### Backend Test Suite (JUnit 5 & Mockito)

The backend includes comprehensive unit, slice, and integration tests covering security, access control, entity lifecycle, and AI services:

```bash
cd backend
mvn test
```

To run isolated unit tests without requiring a local database:
```bash
mvn test -Dtest=UserServiceTest,AuthServiceTest,TaskServiceTest,JacksonConfigTest
```

To view HTML execution reports after running test suites:
```bash
open target/surefire-reports/
```

---

## License

This project is licensed under the MIT License — see the LICENSE file for details.
