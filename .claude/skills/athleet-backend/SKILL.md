---
name: athleet-backend
description: Conventions and architecture for the Athleet backend (Spring Boot modular monolith, multi-tenant like Acadware, serving the React web admin and the Parent/Staff apps; AJSDP and UKSC are organizations in it). Use whenever adding, changing or reviewing anything under backend/ — new features, entities, endpoints, database migrations, or deciding which module code belongs in.
---

# Athleet Backend

One Spring Boot backend shared by the React web admin (`web/`), Parent app and Staff app.

**Goal:** rebuild the user's own Acadware admin (https://acadware.net/aw-admin) like-for-like, then extend it.
`docs/acadware-feature-inventory.md` is the parity checklist (screens, fields, wording, menu order). **Fees are deferred to the
final phase.** The Athleet Platform Functionality Document (https://claude.ai/artifact/DQLuehzhzvhBoUcZkJsb3g) lists the extras
(feature IDs P1…, S1…, W1…).

**Generic multi-tenant model (same as Acadware).** AJSDP and UKSC are not separate code paths; they are organizations:

```
primary organization (e.g. AJSDP)            organization.parent_id = null
  └─ affiliated academy (e.g. a school)      organization.parent_id = primary
       └─ center  (label per org: "Class" for AJSDP — Branding → Center Name Title)
            └─ batch (weekly slots + coaches + capacity)
                 └─ student (one or more batches of the same center)
```

## Stack

- Java 17, Spring Boot 3.x, Maven multi-module build
- PostgreSQL (installed locally for development; no Docker), Flyway migrations
- Spring Security with our own JWT (short-lived access token + refresh token)
- S3-compatible file storage (local folder in dev, AWS S3 Mumbai in prod)
- OpenAPI/Swagger for the API contract consumed by web and mobile
- No unit tests and no CI/CD for now — do not add test folders, test dependencies or pipelines unless asked.

## Module layout

Maven multi-module: `backend/pom.xml` is the parent (Spring Boot parent, shared versions);
each module has its own `pom.xml`. Build from `backend/` with `mvn clean package` (needs JDK 17 or newer on `JAVA_HOME`).

```
backend/
├── pom.xml            parent POM
├── athleet-core/      platform: auth, organizations, IAM, audit, notifications, common helpers
├── athleet-academy/   academy features: centers/classes, batches, students, dashboard (then attendance, assessment, …)
└── athleet-app/       Spring Boot entry point + configuration; assembles the modules
```

Packages: `com.athleet.core.*`, `com.athleet.academy.*`, `com.athleet.app`. New feature modules (e.g. `athleet-fees`) may be
added later; they depend on core (and academy if needed), never the other way round.

### athleet-core
| Package | Responsibility |
|---|---|
| `auth` | Email/mobile + password login, access JWT (15 min, in memory on the client), rotating refresh token (HttpOnly cookie), invite / reset via one-time password tokens |
| `organization` | Primary + affiliated organizations, branding (center label, currency, date format), "my access" for the admin menu |
| `iam` | Users, roles with per-module permissions (`AppModule` × `NONE/VIEW/MANAGE`), memberships (user ↔ organization ↔ role, optional center), staff, `AccessService` |
| `audit` | Audit log written in the caller's transaction |
| `notification` | `MessageSender` strategy (`log` in dev only, `none` default; real email/SMS/WhatsApp later) |
| `storage` | `FileStorage` strategy (`local` in dev, `none` default, S3 Mumbai later), validated + re-encoded image uploads (`FileService`), `stored_file` metadata, HMAC-signed short-lived download links. Features claim a file with `FileService.attach` inside their own transaction |
| `common/*` | `error`, `paging`, `persistence`, `security`, `config` |

### athleet-academy
`center` (centers + batches) · `student` · `dashboard` · `attendance` · `common`. Implements core's `CenterDirectory` so core can validate center ids.

`attendance`: student sessions per batch and date (`SessionWorkflow` is the only place that defines status transitions;
approval publishes `AttendanceSessionApproved` for after-commit listeners), staff in/out shifts (location recorded and
flagged, never used to refuse a punch), per-organization `attendance_config`, and read-only live/tracker/student-month
reports. Permissions: `ATTENDANCE` (view; MANAGE marks and submits, only batches the user coaches unless they also hold
`ATTENDANCE_APPROVAL`) and `ATTENDANCE_APPROVAL` (approve, reject, reopen, correct punches). "Today" is Asia/Kolkata
(`AttendanceClock`).

### Inside each feature package
```
<feature>/
├── web/         REST controllers (thin: validate, call service, map to DTO)
├── service/     business logic and transactions
├── domain/      JPA entities, enums, value objects
├── repository/  Spring Data repositories
└── dto/         request/response records
```

## Hard rules

1. **Tenant isolation through `AccessService`.** Every organization-scoped service method starts with
   `OrgAccess a = access.require(orgId, AppModule.X, AccessLevel.VIEW|MANAGE)`. Every query filters by `organization_id`
   (and by `a.centerId()` when the caller holds a CENTER-type role). By-id loads use `findByIdAndOrganizationId` + `a.requireCenter(...)`.
   Outside scope → 404 (not 403) so ids cannot be probed. Inside a caller's transaction use the non-throwing `access.can(...)`.
2. **Access rules:** platform admin = everything; direct membership = its role's permissions; a HEAD_OFFICE membership in a primary
   organization also applies to its affiliates; CENTER roles are limited to their center; STUDENT roles get no admin access.
   Nobody can create/assign a role with more permission than they hold (escalation check in `RoleService`).
3. **Module dependencies:** core never depends on academy; cross-module needs go through core interfaces (`CenterDirectory`).
4. **Migrations** live in `athleet-core/.../db/migration/core` and `athleet-academy/.../db/migration/academy` (one `public` schema).
   Name files `V<yyyyMMdd><nnnn>__<description>.sql` (date plus a 4-digit sequence, e.g. `V202611240002__attendance.sql`);
   never edit an applied migration; `ddl-auto=validate`. Use `integer` (not `smallint`) for columns mapped to Java `int`.
5. **API paths:** `/api/v1/auth/**`, `/api/v1/organizations/**`, and everything tenant-scoped under `/api/v1/orgs/{orgId}/...`.
6. **Audit**: create/update/delete of centers, batches, students, roles, staff (and later attendance, scores, fees) writes an audit
   record without personal details in `details`.
7. **Offline sync** (Staff app, later): records carry a client UUID; sync endpoints are idempotent on it; server re-validates geofence.
8. **Data in India**: no service or storage outside Indian regions.

## Key product decisions (from discussion)

- Parents: one mobile number per student; children linked automatically by that number.
- Absence alerts (push + SMS) go out **only after** the session's attendance is approved.
- Geofence default 200 m, configurable per center; checked on device and server.
- Fitness grades 1–5 per category from admin-configured age/gender benchmark tables.
- Report cards are published manually per school/batch.
- Payments: Razorpay online + manual cash/UPI/bank entry; GST configurable per school/academy; invoice numbers per financial year.
- OTP SMS provider not chosen yet — in dev, log OTPs instead of sending.

## Security: write SAST-clean code

Code must pass static security analysis (SonarQube, Semgrep, SpotBugs/FindSecBugs, Snyk Code, Checkmarx-style rules) without suppressions. Write it right the first time:

**Injection**
- Use Spring Data derived queries, JPQL/Criteria with bind parameters (`:name`), or `JdbcTemplate` with `?` placeholders. **Never** build SQL/JPQL by string concatenation or `String.format`, including `ORDER BY` — map sort fields through an allow-list enum.
- No `Runtime.exec`/`ProcessBuilder` with user input. No user input in file paths: generate storage keys server-side (UUID) and never use the uploaded filename as a path.
- No user input in log format strings or LDAP/XPath/regex built at runtime; escape or reject.

**Authentication & access control**
- Every endpoint is authenticated unless explicitly listed as public in the security config (login, refresh, logout, forgot/set password, health; later OTP and Razorpay webhook). Deny by default.
- Check role **and** scope in the service layer (not only `@PreAuthorize`), and check object ownership on every by-ID lookup (IDOR): load by `id AND scope`, return 404 if outside scope.
- Passwords hashed with `BCryptPasswordEncoder`/`DelegatingPasswordEncoder` only. OTPs: 6 digits from `SecureRandom`, stored hashed, 5-minute expiry, max 5 attempts, rate-limited per number and IP.
- JWT: sign with a strong key from config (HS256 ≥ 256-bit or RS256), always verify signature, `exp`, `iss`; never accept `alg=none`. Refresh tokens stored hashed, rotated on use, revocable.
- Razorpay webhooks: verify the HMAC signature before trusting any payload; amounts always recomputed server-side from the invoice.

**Secrets & config**
- No secrets, keys, passwords or tokens in code, `application.yml` or Git. Read from environment variables (`${DB_PASSWORD}`); commit only `application-example.yml` placeholders.
- No hard-coded credentials in seed data or migrations.

**Data exposure**
- Never return JPA entities from controllers — always DTOs. Never serialise password hashes, OTPs, tokens or internal IDs that aren't needed.
- Don't log PII (child names, phone numbers, medical notes), tokens or OTPs. Mask phone numbers in logs (`98xxxxxx21`).
- Global `@RestControllerAdvice` returns a generic error body; no stack traces or SQL messages to clients (`server.error.include-stacktrace=never`).

**Input & files**
- Validate every request DTO with `@Valid` + Bean Validation (`@NotNull`, `@Size`, `@Pattern`, `@Min/@Max`). Bound sizes of strings, lists and page size (max 100).
- File uploads: allow-list content type **and** extension, enforce size limits, check magic bytes, store outside web root, serve via pre-signed URLs.
- Excel uploads (Apache POI): protect against zip bombs/XXE — use POI defaults with `ZipSecureFile` limits; never enable external entities in any XML parser.
- No Java native deserialisation (`ObjectInputStream`); Jackson without default typing.

**Web**
- CORS restricted to known web-admin origins (no `*` with credentials). CSRF is disabled because API calls use a bearer header; the only cookie is the refresh token, which is HttpOnly, `SameSite=Strict` and scoped to `/api/v1/auth`.
- Security headers on (HSTS, X-Content-Type-Options, frame-options deny). HTTPS only in prod.
- Use `SecureRandom` for anything security-related; never `Math.random`/`Random`.
- Keep dependencies on the Spring Boot BOM versions; don't pin old versions of transitive libraries.

## Design patterns and code structure

- **Layered per feature**: `web → service → repository`. Controllers are thin (validate, call one service method, return DTO). Business rules live only in services/domain.
- **DTOs as Java `record`s**; mapping via small static mapper methods or MapStruct — no entity leaks.
- **Constructor injection only** (`final` fields, no `@Autowired` on fields).
- **Strategy** for swappable providers behind core interfaces: `SmsSender` (log-only in dev, MSG91 etc. in prod), `PushSender`, `FileStorage` (local / S3), `PaymentGateway` (Razorpay). Select implementation via `@ConditionalOnProperty`.
- **State machine** for workflows with explicit enums and allowed transitions in one place: session attendance (`DRAFT → SUBMITTED → APPROVED | REJECTED → RESUBMITTED`), registration/admission, invoice (`DUE → PARTIALLY_PAID → PAID | REFUNDED | WAIVED`). Reject illegal transitions with a domain exception.
- **Domain events** (`ApplicationEventPublisher` + `@TransactionalEventListener(phase = AFTER_COMMIT)`) for side effects: attendance approved → absence alerts; report card published → parent notification; any audited change → audit record. Keeps modules decoupled and notifications out of the main transaction.
- **Specification/Criteria** for dynamic list filters (scope + search + filters) instead of many repository methods.
- **Template method** for shared flows with per-organization variations (e.g. report card generation, bulk upload validation) — driven by organization settings, not by separate code per program.
- **Scheduler** (`@Scheduled` + ShedLock if more than one instance) for 48h escalation, fee invoice generation and reminders. Jobs must be idempotent.
- **Idempotency key** (client UUID) on sync and payment endpoints.
- Custom exceptions (`NotFoundException`, `ForbiddenException`, `BusinessRuleException`) mapped centrally to HTTP status — no `try/catch` returning error strings in controllers.
- Use `java.time` (`Instant` for timestamps in UTC, `LocalDate` for dates, zone `Asia/Kolkata` only at display/reporting). Money as `BigDecimal` with scale 2, never `double`.
- Avoid: god services, static utility classes holding state, circular module dependencies, business logic in entities' getters, `Optional` as fields/parameters.

## Performance

**Database & JPA**
- All associations `FetchType.LAZY` (including `@ManyToOne`). Load what a screen needs with `JOIN FETCH`, `@EntityGraph` or DTO projections — **avoid N+1** queries. Keep `spring.jpa.open-in-view=false`.
- List/report endpoints use projections (interface/record DTOs) and return only needed columns.
- **Always paginate** lists (`Pageable`, max page size 100). For large/infinite lists (attendance history, audit log) prefer keyset pagination on `(created_at, id)`.
- Index every foreign key and every column used in `WHERE`/`ORDER BY` of hot queries (scope columns: `organization_id`, `center_id`, `batch_id`, `status`, `session_date`). Add indexes in the same migration as the table.
- Batch writes: `hibernate.jdbc.batch_size=50`, `order_inserts/order_updates=true`; use sequence-based IDs (or UUID generated in app), not `IDENTITY`, so batching works. Bulk Excel upload and sync use `saveAll` in chunks, not row-by-row transactions.
- Keep transactions short: `@Transactional(readOnly = true)` on read services; no remote calls (SMS, push, S3, Razorpay) inside a DB transaction — publish an event and do it after commit.
- Dashboards/aggregates computed with SQL `GROUP BY` (or pre-aggregated summary tables refreshed by a job), never by loading rows into Java and looping.
- Use HikariCP defaults sized to the DB (start with pool size 10–20); watch slow-query logs (`log_min_duration_statement`).

**API & app**
- Heavy work runs async (`@Async` with a bounded `ThreadPoolTaskExecutor`): bulk uploads, report card PDF generation, bulk notifications, Excel/PDF exports. Return a job ID and let the client poll / get notified.
- Stream large exports (Excel via SXSSF streaming workbook, CSV streaming) instead of building them in memory.
- Cache rarely changing reference data (programs, benchmark tables, org structure, fee plans) with Spring Cache (Caffeine); evict on update.
- Files go through pre-signed S3 URLs — the backend never proxies large file bytes.
- Sync endpoint accepts batched payloads (e.g. up to 500 records) and processes them in one transaction per batch.
- Enable response compression; keep JSON responses lean (no nested object graphs).
- Use `Instant`-based filters with indexed date columns instead of functions on columns in `WHERE` (e.g. avoid `date(created_at) = ?`).

## When adding a feature

1. Find the Acadware screen in `docs/acadware-feature-inventory.md`; pick the module (core / academy / new module) and feature package; create the five sub-packages if missing.
2. Add a Flyway migration in that module's schema folder.
3. Entity → repository → service (`access.require` + audit) → DTOs → controller under `/api/v1/orgs/{orgId}/...`.
5. Add the matching React screen in `web/` (see README) with the same fields and labels as Acadware.
4. Document the endpoint with OpenAPI annotations so web/mobile clients can be generated.
