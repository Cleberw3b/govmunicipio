# Codebase Improvement Plan

**Date:** 2026-03-18
**Authors:** All 6 agents (Backend, Project Manager, QA, Designer, Frontend, Database Specialist)
**Status:** Implemented (2026-03-18)

---

## Executive Summary

After a thorough analysis of the GovMunicípio codebase, the team identified improvements across six areas: backend architecture, database & data structure, project management, quality assurance, user experience, and frontend engineering. This plan is organized by priority (P0 = critical, P1 = high, P2 = medium, P3 = nice-to-have) and grouped by responsible agent.

---

## P0 — Critical (Security & Stability)

### 1. Audit and Expand Test Coverage (QA Engineer)

**Problem:** While the codebase has existing `.spec.ts` test files (NestJS auto-generated), the test coverage for business-critical services and flows needs auditing and expansion. The bash smoke test (`docs/tests/smoke-test.sh`) covers basic endpoints but does not test edge cases, error paths, or complex workflows.

**Tasks:**
1. Audit existing test files — identify which services/controllers have real test logic vs. scaffold-only tests
2. Expand tests for critical services: `AuthService` (OTP flow), `TfdService` (draft→submit lifecycle), `AdminService` (transaction rollback), `MunicipalityService` (scoped queries)
3. Add integration tests for cross-module flows: municipality creation (creates Org + Person + Principal in transaction), TFD submission (validates fields + sends WhatsApp)
4. Add edge case tests: invalid UUIDs, duplicate CNPJ/CPF, expired OTP, unauthorized role access
5. Set up a test database configuration (Docker-based or in-memory) for integration tests
6. Add `pnpm test` to the Turborepo pipeline and enforce coverage thresholds

**Acceptance criteria:** 80%+ coverage on business-critical services; all transaction flows tested; CI-ready.

---

### 2. Document and Harden WhatsApp Service Configuration (Backend Engineer)

**Problem:** The `whatsapp.service.ts` correctly reads `WHATSAPP_API_URL`, `WHATSAPP_API_KEY`, and `WHATSAPP_INSTANCE` from `ConfigService`, but these env vars are undocumented in `SECURITY.md` and `.env.example`. The service needs better error handling for missing config and delivery failures.

**Tasks:**
1. Add `WHATSAPP_API_URL`, `WHATSAPP_API_KEY`, `WHATSAPP_INSTANCE` to `docs/SECURITY.md` env var table
2. Add entries to the API `.env.example` file
3. Add graceful fallback when WhatsApp config is missing (log warning, skip notification instead of failing silently)
4. Add structured logging for notification success/failure (include protocol number for tracing)
5. Add retry logic or dead letter queue for failed notifications

**Acceptance criteria:** All WhatsApp env vars documented; missing config logs a warning; delivery failures logged with context.

---

### 3. Add ParseUUIDPipe to All Route Params (Backend Engineer)

**Problem:** Most controller route params (`:id`, `:hospitalId`, `:specialtyId`, etc.) do not use `ParseUUIDPipe`. Invalid UUIDs cause TypeORM `string_to_uuid` crashes (500 errors) instead of returning 400.

**Tasks:**
1. Audit all controllers for route params without `ParseUUIDPipe`
2. Add `@Param('id', ParseUUIDPipe)` to every route param across all controllers
3. Add smoke test cases for invalid UUID params
4. Verify 400 responses instead of 500

**Acceptance criteria:** All UUID route params validated; no `string_to_uuid` crashes possible.

---

## P1 — High Priority (Architecture & Reliability)

### 4. Extract Reusable API Hooks on Frontend (Frontend Engineer)

**Problem:** Every page duplicates the same data-fetching pattern: `useState` + `useEffect` + `apiClient()` + loading/error states. This leads to inconsistent error handling and lots of boilerplate.

**Tasks:**
1. Create a `useApi<T>(endpoint, options?)` custom hook that encapsulates: fetch, loading, error, refetch
2. Create entity-specific hooks: `useHospitals()`, `useTfdRequests(status?)`, `useUsers()`, etc.
3. Migrate existing pages to use hooks — start with `/dashboard` and `/tfd/requests`
4. Ensure hooks handle 401 redirect consistently

**Acceptance criteria:** At least 5 pages migrated; no direct `apiClient` calls in page components for data fetching.

---

### 5. Add Error Boundary and Global Error Handling (Frontend Engineer + Designer)

**Problem:** There is no error boundary in the React app. Unhandled errors cause a white screen. There are no user-facing error pages (404, 500).

**Tasks:**
1. Create a React Error Boundary component wrapping the protected layout
2. Create `/not-found` page for 404 errors
3. Create an error page component for unexpected crashes
4. Add error states to all data-fetching pages (currently some pages silently fail)
5. Design error/empty state components with consistent styling

**Acceptance criteria:** No white screens on errors; all pages show meaningful error messages.

---

### 6. Implement Pagination on List Endpoints (Backend Engineer + Frontend Engineer)

**Problem:** All list endpoints (`GET /admin/hospitals`, `GET /tfd/requests`, etc.) return all records without pagination. This will not scale.

**Tasks:**
1. Create a `PaginationDto` with `page`, `limit`, `sortBy`, `sortOrder` fields
2. Create a `PaginatedResponse<T>` wrapper with `data`, `total`, `page`, `limit`, `totalPages`
3. Apply pagination to all list endpoints (start with `GET /tfd/requests` and `GET /admin/hospitals`)
4. Update frontend pages to support pagination (next/prev buttons, page size selector)
5. Add `LIMIT`/`OFFSET` to all TypeORM queries

**Acceptance criteria:** All list endpoints paginated; frontend shows pagination controls; default limit: 20.

---

### 7. Centralize Type Definitions (Frontend Engineer + Backend Engineer)

**Problem:** The frontend defines types locally in each page file (e.g., `interface Hospital { ... }` repeated in multiple files). These often drift from the API response shape. The shared package has interfaces but the frontend doesn't fully consume them.

**Tasks:**
1. Audit all locally defined types in `apps/web/src/app/` pages
2. Move common entity shapes to `packages/shared/src/interfaces/`
3. Create response-specific types where needed (e.g., `HospitalWithOrganization`)
4. Update all frontend pages to import from `@govmunicipio/shared`
5. Remove duplicate local type definitions

**Acceptance criteria:** No duplicate type definitions across pages; shared package is the single source of truth.

---

### 8. Add CI/CD Pipeline (Project Manager + QA Engineer)

**Problem:** There is no CI/CD pipeline. No automated checks run on push or PR. Tests, linting, and builds are not validated before merge.

**Tasks:**
1. Create GitHub Actions workflow for: lint, type-check, build, test
2. Run `pnpm audit` in CI to catch vulnerable dependencies
3. Add branch protection rules requiring CI pass before merge
4. Add deployment previews for frontend (Vercel already does this automatically)
5. Document the CI/CD process in `docs/`

**Acceptance criteria:** Every PR runs lint + type-check + build + test; merges blocked on failure.

---

## P2 — Medium Priority (Developer Experience & UX)

### 9. Refactor Large Page Components (Frontend Engineer + Designer)

**Problem:** Several pages are very large single-file components. The TFD new request page is 91KB. The admin municipalities page, users page, and hospitals pages each contain form logic, table rendering, dialog state, and API calls in a single file.

**Tasks:**
1. Extract dialog/modal forms into separate components (e.g., `CreateHospitalDialog`, `EditUserDialog`)
2. Extract table sections into table components (e.g., `HospitalsTable`, `UsersTable`)
3. Extract form validation schemas into separate files
4. Create a `components/shared/` directory for reusable cross-page components
5. Prioritize the `/tfd/requests/new` page (91KB) — split into step components

**Acceptance criteria:** No page component exceeds 500 lines; multi-step form has one component per step.

---

### 10. Add Loading Skeletons and Empty States (Designer + Frontend Engineer)

**Problem:** Loading states use a simple spinner. Empty states show nothing or a generic message. This makes the UI feel unpolished.

**Tasks:**
1. Design skeleton loading components for tables, cards, and forms
2. Create reusable `<EmptyState icon={...} title="..." action={...} />` component
3. Apply to all pages: dashboard, hospitals, hotels, users, TFD requests
4. Add empty state guidance in Portuguese (e.g., "Nenhum hospital vinculado. Clique em 'Vincular' para começar.")

**Acceptance criteria:** All pages have skeleton loaders and meaningful empty states.

---

### 11. Audit and Add Missing Database Indexes (Database Specialist)

**Problem:** While TypeORM auto-creates indexes for `@ManyToOne` relationships, there is no explicit indexing strategy. Frequently filtered columns like `status_id` on `tfd_request`, `organization_id` on `principal`, and `municipality_id` on `pickup_address` may benefit from composite indexes. The `tfd_request` table will grow fast and queries filtering by status + municipality need to be fast.

**Tasks:**
1. Audit all entities for missing indexes on frequently queried columns
2. Add composite index on `tfd_request(municipality_id, status_id)` for the main list query
3. Add index on `otp_token(principal_id, expires_at)` for OTP lookup performance
4. Add index on `person_identification(cpf)` — already unique, verify index exists
5. Review all junction tables for proper composite primary key indexes
6. Create a migration for all new indexes
7. Document indexing decisions in `docs/ARCHITECTURE.md`

**Acceptance criteria:** All high-traffic queries have supporting indexes; migration created; documented.

---

### 12. Review and Fix Migration Reversibility (Database Specialist + QA Engineer)

**Problem:** The project has 13 migrations but there is no verification that `down()` methods are correct or complete. Irreversible migrations make rollbacks impossible.

**Tasks:**
1. Audit all 13 migrations for complete `down()` implementations
2. Fix any empty or incomplete `down()` methods
3. Test `migration:revert` for each migration on a local database
4. Add a CI step that validates migrations can run up and down
5. Document migration conventions in `docs/ARCHITECTURE.md`

**Acceptance criteria:** All migrations reversible; tested locally; CI step added.

---

### 13. Implement Soft Delete Pattern (Backend Engineer + Database Specialist)

**Problem:** Some entities use `isActive` flags but there is no consistent soft delete pattern. Deleting pickup addresses is a hard delete. There is no audit trail for deletions.

**Tasks:**
1. Define a project-wide soft delete strategy (TypeORM `@DeleteDateColumn` vs. `isActive` flag)
2. Apply consistently to entities that support deletion (pickup addresses, specialties)
3. Update list queries to exclude soft-deleted records by default
4. Add `includeDeleted` query param for admin endpoints where needed
5. Document the pattern in `docs/ARCHITECTURE.md`

**Acceptance criteria:** Consistent soft delete across all deletable entities; no data permanently lost on delete.

---

### 14. Add Request Logging and Monitoring (Backend Engineer + QA Engineer)

**Problem:** There is minimal logging. The only log is in `JwtAuthGuard` for unauthorized attempts. There is no request logging, no performance monitoring, and no structured log format.

**Tasks:**
1. Add a NestJS interceptor for request/response logging (method, path, status code, duration)
2. Use structured JSON log format for Railway log ingestion
3. Add correlation IDs (request ID) for tracing
4. Log all authentication events (login success/failure, OTP requests)
5. Add slow query detection (log queries over 500ms)

**Acceptance criteria:** All requests logged with timing; structured JSON format; correlation IDs in place.

---

### 15. Improve Form Validation UX (Designer + Frontend Engineer)

**Problem:** Form validation is inconsistent. Some forms validate on submit only, others on change. Error messages mix Portuguese and English. CNPJ and CPF validation is mask-based only (no check digit verification).

**Tasks:**
1. Standardize validation timing: validate on blur + on submit
2. Ensure all error messages are in Portuguese
3. Add CNPJ check digit validation (algorithm-based, not just mask)
4. Add CPF check digit validation
5. Add real-time validation feedback (green checkmark on valid, red on invalid)
6. Standardize the Zod schema pattern across all forms

**Acceptance criteria:** All forms validate on blur; all messages in pt-BR; CPF/CNPJ algorithmically validated.

---

### 16. Add Accessibility Improvements (Designer)

**Problem:** The frontend does not implement accessibility best practices. No ARIA labels on interactive elements, no skip-navigation link, unclear focus management in dialogs, no keyboard navigation support in tables.

**Tasks:**
1. Audit all pages with an accessibility checker
2. Add `aria-label` to all icon-only buttons
3. Add skip-to-content navigation link
4. Ensure all dialogs trap focus and return focus on close
5. Add keyboard navigation to tables (arrow keys for row selection)
6. Verify color contrast ratios meet WCAG AA

**Acceptance criteria:** No critical accessibility violations; all interactive elements keyboard-accessible.

---

## P3 — Nice to Have (Polish & Future)

### 17. Add Dark Mode Support (Designer + Frontend Engineer)

**Problem:** The app only supports light mode. `next-themes` is already a dependency but unused.

**Tasks:**
1. Define dark mode color palette in `globals.css`
2. Add theme toggle to sidebar/header
3. Use CSS variables for all colors (shadcn/ui already supports this)
4. Test all pages in both modes

**Acceptance criteria:** Full dark mode support; toggle in the sidebar.

---

### 18. Add Notification System (Backend Engineer + Frontend Engineer)

**Problem:** The only notification is the WhatsApp fire-and-forget on TFD submission. There is no in-app notification system for status changes, new users, etc.

**Tasks:**
1. Design a `NotificationEntity` with type, recipient, message, read status
2. Create a notification service on the API
3. Add `GET /notifications` and `PATCH /notifications/:id/read` endpoints
4. Add notification bell icon in the frontend header with unread count
5. Trigger notifications on: TFD status change, new user creation, hospital link

**Acceptance criteria:** In-app notifications for key events; bell icon with badge count.

---

### 19. Add Audit Log (Backend Engineer + Database Specialist + Project Manager)

**Problem:** There is no audit trail. Administrative actions (create municipality, change user roles, approve TFD) are not logged.

**Tasks:**
1. Create an `AuditLogEntity` with: actor, action, entity type, entity ID, timestamp, old/new values
2. Create a NestJS interceptor to automatically capture CRUD events
3. Add `GET /admin/audit-logs` endpoint for super_admin
4. Add audit log viewer page in the admin frontend

**Acceptance criteria:** All create/update/delete operations logged; queryable by super_admin.

---

### 20. Add PDF Report Generation for TFD Requests (Backend Engineer + Designer)

**Problem:** TFD requests can only be viewed in the browser. There is no way to generate a printable PDF report for a TFD request (needed for physical records and official documentation).

**Tasks:**
1. Add PDF generation library to the API (e.g., puppeteer or pdfkit)
2. Create a `GET /tfd/requests/:id/pdf` endpoint
3. Design the PDF template with municipality header, patient info, travel details, approval status
4. Add "Baixar PDF" button on the TFD request detail page

**Acceptance criteria:** PDF generated with all TFD request data; printable format; download button on detail page.

---

## Implementation Roadmap

| Phase | Duration | Items | Lead |
|-------|----------|-------|------|
| Phase 1: Foundation | 2 weeks | P0 items (1-3): Tests, WhatsApp hardening, UUID validation | QA + Backend |
| Phase 2: Architecture | 3 weeks | P1 items (4-8): Hooks, error handling, pagination, types, CI/CD | Frontend + Backend + PM |
| Phase 3: Polish | 3 weeks | P2 items (9-16): Refactoring, UX, indexes, migration audit, soft delete, logging, validation, a11y | All agents |
| Phase 4: Features | 2 weeks | P3 items (17-20): Dark mode, notifications, audit, PDF | All agents |

**Total estimated effort:** ~10 weeks

---

## Dependencies Between Items

```
Item 1 (Tests) → unblocks Item 8 (CI/CD)
Item 4 (API Hooks) → simplifies Item 9 (Refactor pages)
Item 6 (Pagination) → requires Item 7 (Centralize types) for response types
Item 7 (Centralize types) → unblocks Item 4 (API Hooks)
Item 10 (Empty states) → benefits from Item 9 (Refactored components)
Item 11 (Indexes) → improves Item 6 (Pagination) query performance
Item 12 (Migration audit) → foundation for Item 13 (Soft delete)
Item 14 (Logging) → enhances Item 8 (CI/CD) with observability
Item 19 (Audit log) → requires Item 11 (Indexes) for query performance
```
