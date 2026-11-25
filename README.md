# Athleet International

Sports academy platform for Athleet: a like-for-like rebuild of the Acadware admin, then Athleet-specific extensions.
Programs such as **AJSDP** (school-based junior sports development) and **UKSC Academy** are organizations
(tenants) in one generic platform: primary organization → affiliated academies → centers ("Class") → batches → students.

## Repository layout

```
backend/                Spring Boot 3.5 (Java 17, Maven) modular monolith
  athleet-core/           auth, organizations, roles/permissions, staff, audit, notifications
  athleet-academy/        centers/classes, batches, students, dashboard
  athleet-app/            Spring Boot entry point and configuration
web/                    React admin (Vite + TypeScript + MUI + TanStack Query)
docs/acadware-feature-inventory.md   Acadware parity checklist (what to build next)
.claude/skills/athleet-backend/SKILL.md   backend architecture, security and conventions
```

Mobile apps (React Native) come later. Requirements: [Athleet Platform – Functionality Document](https://claude.ai/artifact/DQLuehzhzvhBoUcZkJsb3g)

## Status

Built (foundation): login with Email / Mobile + password, invite and password reset, organization selector (primary +
affiliates, Primary / Academy Admin views), roles with a permission matrix, staff, classes, batches (training days, timings,
coaches, capacity), students (Active / Submitted, add/edit, batches/transfer, deregistration, approve), dashboard
(headcount, age, gender, utilization), branding (center label, currency, date format).

Attendance is built end to end: student sessions with approval, staff in/out with selfie and geofence flag, configuration,
live view and tracker, in the API and in the web admin (Attendance page, My attendance punch, Dashboard → Attendance,
Settings → Attendance Configuration, student month view).

Next, from the inventory: reports, requests, expenses, messaging, posts, assessment, coaching drills,
remaining settings. **Fees are deferred to the final phase.**

## Run locally

Prerequisites: JDK 17, Maven 3.9+, Node 20+, PostgreSQL 16.

1. Create a database and user (example):
   ```sql
   create user athleet with password '<choose one>';
   create database athleet owner athleet;
   ```
2. Set environment variables (see `backend/.env.example`; never commit real values):
   `SPRING_PROFILES_ACTIVE=dev`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET` (base64, 32+ bytes:
   `openssl rand -base64 48`), and for the first start `BOOTSTRAP_ADMIN_EMAIL` + `BOOTSTRAP_ADMIN_PASSWORD` (12+ characters)
   to create the first platform admin. Remove the bootstrap values afterwards.
3. Backend: `cd backend && mvn clean package && java -jar athleet-app/target/athleet-app-0.0.1-SNAPSHOT.jar`
   (Flyway creates the schema; Swagger UI at http://localhost:8080/swagger-ui.html in the `dev` profile).
   Maven uses `JAVA_HOME`, not whatever `java` is first on your PATH: run `mvn -v` and make sure it reports Java 17.
   For file uploads (attendance selfies) also set `STORAGE_URL_SECRET` (32+ random characters); optional
   `STORAGE_LOCAL_ROOT` chooses the upload folder (default `~/.athleet/files`).
4. Web: `cd web && npm install && npm run dev` → http://localhost:5173 (proxies `/api` to the backend).

In the `dev` profile invite and reset links are written to the backend log instead of being emailed.
