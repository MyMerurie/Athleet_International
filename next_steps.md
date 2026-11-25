# Next Steps

A handover guide for anyone continuing work on Athleet. It explains where the project stands, how to set it up and
work in it, and what to build next, in order.

**Goal:** rebuild the Acadware admin (https://acadware.net/aw-admin) like-for-like (same screens, fields and wording),
then add Athleet-specific features. The parity checklist is [docs/acadware-feature-inventory.md](docs/acadware-feature-inventory.md).
**Fees are built last** (see Phase 6).

---

## 1. Where things stand (as of 2026-11-25)

Done and merged to `main`:

| Area | What exists |
|---|---|
| Auth | Login (email or mobile + password), invite → set password, forgot/reset password, JWT access token in memory, rotating HttpOnly refresh cookie with reuse detection, rate limiting, audit log |
| Tenancy | Organizations (primary + affiliated academies), org selector, Primary / Academy Admin views |
| Access | Roles (Head Office / Class types) with a per-module permission matrix (`AppModule` × `AccessLevel`), center-scoped roles |
| Staff | List, invite, edit, role assignment |
| Classes | Centers ("Class", label configurable), batches with training days, timings, coaches and capacity |
| Students | Active / Submitted tabs, add/edit (3 steps: details, up to 3 secondary contacts, address & health incl. kit size), change batches, approve self-registrations, deregister; auto student number. **Profile page** (`/org/:orgId/students/:studentId`, opened from the name or the row menu "Profile"): Details, Contacts, Training (days from the batch slots), Attendance (month view), Injuries and History tabs, plus tag chips. Row menu: Profile, Edit, Batches, Transfer Student (to another academy of the group), Deregistration, Attendance, Tag Student, Injury Log, Student History and ID Card all work |
| Dashboard | General (Headcount, Utilization) and Attendance (Live, Tracker) tabs. The Performance tab shows an info message |
| Settings | Branding Preference (center label, currency, date format), Attendance Configuration and Player Unique ID Auto-generation (switch, prefix, "apply to students without one"). Every other settings section is a placeholder |
| Web admin | React screens for all of the above, plus the Attendance page (mark students, approvals, staff in/out) and a My attendance punch dialog in the top bar; other sidebar items open a "Coming soon" page (`/org/:orgId/soon/:module`) |

Attendance (Phase 1: backend smoke-tested through the API, screens built and checked in the browser):

| Area | What exists |
|---|---|
| Permissions | `ATTENDANCE` (view / mark) and `ATTENDANCE_APPROVAL` (approve, reject, reopen, correct punches) modules in the Roles matrix; default roles and a backfill migration for existing ones |
| Student attendance | Per batch and date, approval workflow DRAFT → SUBMITTED → APPROVED / REJECTED → RESUBMITTED, Present / Absent marks, roster merge, optimistic locking, date window and training-day checks. Approval publishes `AttendanceSessionApproved` (no alerts sent yet) |
| Staff attendance | Self punch in/out (web or Staff app, `clientId` makes retries safe), selfie, tasks on out, geofence distance recorded and flagged (never blocks), supervisor add / correct with a reason |
| Configuration | Attendance Configuration per organization: mandatory selfie, tasks with out punch, device info in reports, backdate / forward-date window |
| Reports (API) | Live attendance (per academy or class), tracker grid (staff or students, max 31 days), one student's month |
| File storage | Core `FileStorage` (local disk in dev, S3 later), validated and re-encoded uploads (EXIF stripped), short-lived signed download links |

Known gaps in the screens: a Center Manager cannot pick a person for "Add shift" because the staff list needs Staff access
(an attendance-scoped staff list would fix it), and the selfie is a plain file input (the mobile apps do the real camera capture).

Notes on what "done" means here:
- **Batches** moves a student between classes and batches *inside one academy*. **Transfer Student** moves them to another
  academy of the same group (primary + its affiliates; Acadware's `TransferPlayer`), see Phase 2B. Past attendance stays with the
  academy where it was recorded, and a linked app login's membership is not moved.
- Unique ID auto-generation (prefix + student number) is a per-academy setting; with it on, the Unique ID is not editable.
- Email/SMS: only `log` and `none` message senders exist (`athleet.messaging.provider`), so nothing is actually sent.

Not done yet: everything listed in Section 4, plus the items in Section 5.

---

## 2. Getting set up

Follow **Run locally** in the [README](README.md). In short:

1. Install JDK 17, Maven 3.9+, Node 20+, PostgreSQL 16.
2. Create a database, then copy `backend/.env.example` to `backend/.env` and fill it in. `.env` is git-ignored;
   **never commit real secrets.** Set `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` for the first start only.
3. Backend: `cd backend && mvn clean package`, then run `athleet-app/target/athleet-app-0.0.1-SNAPSHOT.jar`.
   Swagger UI: http://localhost:8080/swagger-ui.html (dev profile).
4. Web: `cd web && npm install && npm run dev` → http://localhost:5173.

Gotchas:
- Maven must run on **JDK 17 or newer**. `java -version` can say 17 while Maven still uses another JDK, because Maven
  reads `JAVA_HOME`. Check with `mvn -v`. The build stops with "Athleet needs JDK 17 or newer" if the JDK is older; set
  `JAVA_HOME` to a JDK 17 folder (PowerShell: `$env:JAVA_HOME = 'C:\Program Files\Eclipse Adoptium\jdk-17...'`).
- In the `dev` profile, invite and reset links are written to the backend log instead of being emailed.
- Stop the running backend before rebuilding on Windows, or the jar stays locked.
- If the build fails with "bad class file ... class file has wrong version 65.0, should be 61.0", an IDE Java extension
  compiled `target/classes` with a newer JDK. Delete `athleet-core/target/classes` and `athleet-academy/target/classes`
  and build again on JDK 17.
- File uploads (attendance selfies) need `STORAGE_URL_SECRET` in `backend/.env` (at least 32 random characters). The
  `dev` profile uses local storage and the app will not start without it. Uploaded files go to `~/.athleet/files`
  unless `STORAGE_LOCAL_ROOT` is set. Without the `dev` profile, storage is off and uploads are refused.

---

## 3. How to work in this repo

### Read first
- [.claude/skills/athleet-backend/SKILL.md](.claude/skills/athleet-backend/SKILL.md): backend architecture, hard rules,
  security, patterns and the "When adding a feature" checklist. Follow it.
- [docs/acadware-feature-inventory.md](docs/acadware-feature-inventory.md): what each Acadware screen contains.

### Branching and merging
1. Branch from an up-to-date `main`: `git checkout main && git pull && git checkout -b feature/<module-name>`.
2. Keep one module (or one coherent change) per branch.
3. Push and open a pull request into `main`. Merge after it builds and has been checked in the browser.

### Adding a module (backend + web)
Use the existing **student** and **center** packages as templates:

1. **Migration**: add `backend/athleet-academy/src/main/resources/db/migration/academy/V<yyyyMMdd><nnnn>__<name>.sql`.
   Never edit a migration that is already on `main`; add a new one. JPA runs with `ddl-auto=validate`, so entity and
   schema must match.
2. **Package layout**: `domain/` (entities, enums), `repository/`, `dto/` (records), `service/`, `web/` (controller).
3. **Access control**: every service method starts with `accessService.require(orgId, AppModule.X, AccessLevel.Y)` and
   every query is filtered by `orgId` (and by `centerId` for center-scoped roles). Records outside the caller's scope
   return **404**, not 403.
4. **Controllers return DTOs only**, never entities. Validate input with Bean Validation.
5. **Web**: add API types in `web/src/api/types.ts`, a page under `web/src/pages/`, a route in `web/src/App.tsx`, and
   switch the sidebar item in `Shell.tsx` from the "Coming soon" route to the new page.
6. Check it in the browser as both an org admin and a center-scoped user (e.g. a coach).

### Security rules (non-negotiable)
- No secrets in code or Git; read them from environment variables.
- Never log personal data (names, emails, phone numbers) or tokens.
- Parameterised queries only; escape `LIKE` input with `Text.likePattern()`.
- Run `npm audit` after adding front-end packages and keep it at 0 vulnerabilities.
- When looking at the live Acadware site for reference, capture **structure only**, never student or staff personal data.

---

## 4. Roadmap (build in this order)

Each item maps to an `AppModule` value and to a section of the inventory. "Done when" is the acceptance bar.

### Phase 1 — Attendance (highest value)
- [x] **Staff attendance** (API): in/out punches with optional selfie and device ID; backdate/forward-date rule.
- [x] **Student attendance** (API): mark per batch session, with approval.
- [x] **Attendance Configuration** settings (API, inventory §10).
- [x] **Live Attendance and Attendance Tracker** (API).
- [x] **Screens**: Attendance page (mark students, approvals, staff in/out), My attendance (punch with selfie),
  Dashboard → Attendance tab (Live + Tracker), Settings → Attendance Configuration form, student row action "Attendance".
- Done when: a coach can mark a batch, an admin sees it on the dashboard and tracker, and config rules are enforced server-side.
- Known limits: the time zone is fixed to Asia/Kolkata (add `organization.timezone` for other regions), the
  configuration is per organization (affiliates do not inherit it), and absence alerts are not sent yet (hook:
  `AttendanceSessionApproved` event).

### Phase 2 — Student profile completion (inventory §11.2)
- Student profile page (opens from a row): details, secondary contacts, kit size, training days, history.
- Remaining Add Student steps (parent/secondary contacts, kit size).
- Row actions: ID Card, Tag Student, Injury Log, Student History (Attendance arrives with Phase 1). Replace the current
  "Transfer Student" (which duplicates Batches) with a real transfer **between academies**, keeping a transfer history.
- Bulk import (CSV) and bulk actions (deactivate/deregister) on selected rows.
- Player Unique ID auto-generation setting (prefix + system ID).

Built in three sub-phases, one at a time (each: build, API check, browser check, tick here, pause for a go-ahead).
Rules for all of them: **minimal UI** (reuse profile tabs, MUI dialogs/tables, the row menu; no new pages, no new npm
packages); one new Flyway migration per sub-phase; the layouts are our own because Acadware's were not captured.

**2.0 — Profile basics (done)**
- [x] Student profile page from the row (name link + "Profile"): Details, Contacts, Training days, Attendance tabs;
  `GET /students/{id}/profile`.
- [x] Add Student step 2: up to 3 secondary contacts; kit size (YS, YM, YL, S, M, L, XL, XXL; assumed list).

**2A — Student records (done, checked via API and browser as owner, center manager and coach)**
- [x] Migration `V202611250002__student_records.sql`: `student_tag`, `student_injury`, `student_history` (history
  backfilled with REGISTERED / DEREGISTERED for existing students).
- [x] **Tag Student**: `PUT /students/{id}/tags` (STUDENT MANAGE; max 10, 1-30 chars, case-insensitive duplicates
  dropped); tag chips on the profile + one small dialog (comma-separated field); row menu item.
- [x] **Injury Log**: `/students/{id}/injuries` CRUD (view = STUDENT VIEW, write = STUDENT MANAGE, so coaches read
  only; no writes for deregistered students); Injuries tab (table + one dialog); row menu item opens the tab.
- [x] **Student History**: events REGISTERED, APPROVED, PLACEMENT_CHANGED, TRANSFERRED, DEACTIVATED, REACTIVATED,
  DEREGISTERED with name snapshots and actor; `GET /students/{id}/history`; History tab (read-only table); row menu item
  opens the tab. Written today for registered, approved, placement changed and deregistered; TRANSFERRED arrives
  with 2B, DEACTIVATED / REACTIVATED with 2C.
- Notes: profile tabs are deep-linkable with `?tab=injuries` / `?tab=history`. Health data (injuries) is audited
  without details. The Students list page loads class options even for users without class access, so a coach sees
  one 403 in the console there (pre-existing, harmless).

**2B — Identity and transfer (done, checked via API and browser; actual printing of the ID card was not tried)**
- [x] Migration `V202611250003__student_config.sql`.
- [x] **Player Unique ID auto-generation**: `student_config` per organization (switch + prefix);
  `GET/PUT /orgs/{orgId}/student-config` (GET = any staff, PUT = SETTINGS MANAGE); `create` sets prefix + student number
  and ignores a typed value, `update` keeps the stored one; a Unique ID is unique per academy (case-insensitive, 409);
  `POST .../student-config/apply` fills students without one (skips values already taken); Settings section and a
  disabled Unique ID field in the student dialog.
- [x] **ID Card**: one dialog (row menu "ID Card" + profile button) with a print stylesheet; web only; initials instead of
  a photo (no student photos yet); emergency contact = first secondary contact, else the student's mobile.
- [x] **Transfer between academies** (replaces the old "Transfer Student" menu item that duplicated Batches):
  `GET .../students/transfer-targets` (other academies of the group where the caller has Student manage, with their
  active classes and batches), `POST .../students/{id}/transfer` (Student manage in both academies, ACTIVE students
  only; email and Unique ID must be free in the target; contacts, tags and injuries move along; one TRANSFERRED history
  row = the transfer history; audit TRANSFER_OUT / TRANSFER_IN). One three-select dialog on the Students row menu.
- Fixed on the way: the attendance session screen resolved students by academy, so a transferred student vanished from
  past sessions; it now resolves by the session's own marks.
- Known limits: past attendance stays with the old academy (the new academy's attendance history for that student starts
  empty); a linked app login's membership is not moved; transfer is offered from the Students row menu only (not from
  the profile page).

**2C — Bulk import and bulk actions**
- [ ] **Bulk actions**: new `INACTIVE` status; `POST .../students/bulk` (DEACTIVATE, ACTIVATE, DEREGISTER; 1-100 ids,
  all-or-nothing); "Inactive" tab, checkbox column and one bulk dialog. Bulk *delete* is not built (it goes through the
  Request flow in Phase 4).
- [ ] **Bulk import (CSV)**: template download, dry-run check with row/column errors, then import in one transaction
  (max 500 rows, 1 MB, no new dependency); one import dialog.

### Phase 3 — Communication
- **Posts** (inventory §8, §11.7): create/edit/delete, media, audience, RSVP attendees.
- **Messaging** (§11.6): inbox and New Message wizard (Academy / Class / Batch / Student-Staff → template → channel).
  Requires a real `MessageSender` implementation (email first; SMS/WhatsApp/push later). Provider keys come from env vars.
- **Notification settings** (§10): the 13 toggles with message text.

### Phase 4 — Requests and Expenses
- **Expense** (§7): staff claims, tiles (pending/approved/rejected and amounts), filters.
- **Request** (§6): delete requests and expense approvals (approve/reject).

### Phase 5 — Performance
- **Assessment** (§9): test bank → parameters (area, unit, numeric/dropdown, comment rule), score entry,
  reports/leaderboards.
- **Dashboard → Performance tab**.
- **Coaching Drills** (§11.8), lesson plans, activity categories, cascade activities.
- Competition / rank master, student rating categories.
- **Reports** launcher (§5, §11.9): student, attendance and performance reports with the filters listed in the inventory.
- Remaining settings: Mobile Apps links, Social Media Handles, Terms & Conditions (versions + acceptance report),
  Dashboard Configuration, full branding colours.

### Phase 6 — Fees (last)
Do **not** add fee code, tables or endpoints before this phase. First enable "Enable Online Payments of Fees" on one
academy in Acadware and capture the Fee Plans, Payment Tracker and Cheque Tracker screens (inventory, "Deferred: Fees").
Then build fee plans, payments (online + manual), partial payments, receipts, tax settings, cheque tracker, write-off,
extensions, exemptions, sales orders, EMI, revenue share, session-based billing and all fee reports.

### After parity
- Athleet-specific extensions (see the Functionality Document linked in the README).
- Parent and Staff mobile apps (React Native) on the same API.

---

## 5. Open items and known gaps

- **Not yet captured from Acadware**: bulk import file format (our own CSV template is used meanwhile; the student profile
  and Add Student steps use our own layouts), Dashboard →
  Performance tab, Assessment reports/leaderboards detail, lesson plans, tournaments, competition tracker, expense
  approval dialog, request filters. Capture these (structure only) before building the matching screens.
- **No automated tests or CI yet.** Add them when the team decides to; until then, smoke-test the API and the UI by hand.
- **Email/SMS are not wired**: messages are only logged (dev) or dropped. Needed before invites and resets work outside dev.
- **Rate limiting is in-process**; move it to a shared store before running more than one backend instance.
- **Deployment**: no production environment, hosting or backup plan defined yet.

---

## 6. Updating this document

When a phase or item is finished, update Section 1 and tick it off here in the same pull request, so this file stays the
single place to see what is next.
