# govmunicipio — Project Guidelines

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system architecture reference.

## Security

See [docs/SECURITY.md](docs/SECURITY.md) for full security guidelines.

Key rules:
- **Never hardcode credentials** — passwords, API keys, tokens, or secrets of any kind in source files, tests, or docs.
- All secrets go in `.env` files (gitignored). Document required vars in the corresponding `.env.example`.
- All API routes are protected by `JwtAuthGuard` + `PermissionsGuard`. Never bypass guards on sensitive routes.
- Use TypeORM named parameters in queries — never string interpolation.
- Always validate UUIDs from route params before passing to queries (empty string causes `string_to_uuid` crash).
- Passwords hashed with bcryptjs (10 rounds). OTP codes expire in 15 minutes.

## Stack

- **API**: NestJS 11 + TypeORM 0.3 + PostgreSQL 16 (Railway) + Redis 7 (ioredis)
- **Frontend**: Next.js 16 App Router + React 19 + Tailwind CSS 4 + shadcn/ui (Vercel)
- **Shared**: TypeScript interfaces, enums, DTOs (`@govmunicipio/shared`)
- **Monorepo**: Turborepo + pnpm 10.32.1 workspaces
- **Runtime**: Node.js 24 (dev/CI), Node.js 22 (Railway via Nixpacks)
- **E2E Testing**: Playwright (Docker-based, 18 tests across 5 spec files)
- **Unit Testing**: Jest + @nestjs/testing (73 tests)
- **CI/CD**: GitHub Actions → conditional deploy to Vercel (web) + Railway (api)
- **Local dev**: Docker Compose (PostgreSQL 16 + Redis 7)

## Key paths

| Path | Description |
|------|-------------|
| `apps/api/src/` | NestJS API source |
| `apps/api/src/entities/` | TypeORM entities (32 concrete + 1 abstract base) |
| `apps/api/src/auth/` | Auth module (JWT, guards, Redis OTP, decorators) |
| `apps/api/src/admin/` | Super admin module (municipalities, hospitals, hotels, orgs, users, specialties, doctors) |
| `apps/api/src/municipality/` | Municipality-scoped module (users, hospitals, hotels, pickup addresses) |
| `apps/api/src/tfd/` | TFD request module (CRUD, status flow, costs, WhatsApp notifications) |
| `apps/api/src/organization/` | Cross-cutting module (hospitals, doctors, specialties lists) |
| `apps/api/src/person/` | Person module (search by CPF/SUS, create) |
| `apps/api/src/common/` | Shared DTOs (pagination), helpers (paginate), interceptors (logging), validators (CPF/CNPJ) |
| `apps/api/src/notification/` | In-app notification module (CRUD, unread count) |
| `apps/api/src/audit/` | Audit log module (CRUD events, admin viewer) |
| `apps/api/src/redis/` | Global Redis module (ioredis client provider) |
| `apps/api/src/database/` | Database config, migrations (14+), seeds |
| `apps/web/src/app/` | Next.js pages (App Router) |
| `apps/web/src/app/(protected)/` | Municipality dashboard routes |
| `apps/web/src/app/admin/` | Super admin routes |
| `apps/web/src/app/auth/` | Login and set-password pages |
| `apps/web/src/app/(protected)/tfd/` | TFD request pages (list, new, detail) |
| `apps/web/src/components/ui/` | shadcn/ui components (14 components) |
| `apps/web/src/components/shared/` | Reusable components (DataTable, EmptyState, ConfirmDialog, PageHeader, skeletons) |
| `apps/web/src/hooks/` | Custom React hooks (useApi, useHospitals, useTfdRequests, useUsers) |
| `apps/web/src/lib/` | Auth, API client, admin-auth, validators (CPF/CNPJ), utils |
| `packages/shared/src/` | Shared interfaces, enums, DTOs |
| `docs/` | Security, deployment, architecture docs |
| `docs/plans/` | Design and implementation plan documents |
| `docs/tests/` | Smoke tests, API test collections |
| `docs/deploy-railway.md` | Railway deployment guide (project IDs, URLs, setup) |
| `docs/database-er-diagram.mermaid` | ER diagram (all 32 entities + relationships) |
| `apps/web/e2e/` | Playwright E2E test specs (auth, dashboard, tfd, admin, accessibility) |
| `apps/web/playwright.config.ts` | Playwright configuration |
| `e2e/` | Docker E2E orchestration (Dockerfile.web, Dockerfile.playwright, docker-compose) |
| `.github/workflows/ci.yml` | CI/CD pipeline (lint, build, unit tests, E2E, conditional deploys) |

## API Modules & Routes

| Module | Prefix | Guard | Key routes |
|--------|--------|-------|------------|
| Auth | `/auth` | Mixed | `POST /login`, `GET /me`, `POST /otp/request`, `POST /otp/verify` |
| Admin | `/admin` | `super_admin` | CRUD for municipalities, hospitals, hotels, organizations, users, specialties, doctors |
| Municipality | `/municipality` | `admin_municipality` | Scoped CRUD for users, hospitals (link/unlink), hotels (link/unlink), pickup addresses |
| Organization | `/` | Permissions | `GET /hospitals`, `GET/POST /doctors`, `GET /specialties` |
| Person | `/persons` | Permissions | `GET /search`, `POST /`, `GET /:id` |
| TFD | `/tfd/requests` | Permissions | `POST /`, `GET /`, `GET /stats`, `GET /:id`, `PATCH /:id`, `POST /:id/submit`, `PATCH /:id/costs`, `PATCH /:id/status` |

## Roles & route access

| Role | Prefix | Capabilities |
|------|--------|-------------|
| `super_admin` | `/admin/*` | Full platform management |
| `admin_municipality` | `/dashboard/*`, `/municipality/*`, `/tfd/*` | Municipality-scoped management |
| `operator_tfd` | `/tfd/*` | TFD request operations |
| `viewer` | `/tfd/*` (read) | View-only access |

## Entities (32 concrete + 1 abstract base)

**Core:** PrincipalEntity, PersonEntity, PersonIdentificationEntity, AddressEntity, ContactEntity
**Organization:** OrganizationEntity, MunicipalityEntity, HospitalEntity, HotelEntity
**Medical:** SpecialtyEntity, DoctorEntity
**TFD:** TfdRequestEntity, PickupAddressEntity
**System:** RoleEntity, PermissionEntity, StatusEntity, ModuleEntity, ModuleStatusEntity, NotificationEntity, AuditLogEntity
**Junction/Link:** MunicipalityHospitalLinkEntity, MunicipalityHotelLinkEntity, PersonAddressLinkEntity, OrganizationAddressLinkEntity, PersonContactLinkEntity, OrganizationContactLinkEntity, PrincipalRoleLinkEntity, PrincipalOrganizationLinkEntity, RolePermissionLinkEntity, HospitalSpecialtyLinkEntity, DoctorSpecialtyLinkEntity

### Data integrity rules

- **No cascades ever** — all FKs use `onDelete: 'RESTRICT'`. No `cascade: true` in TypeORM.
- **Universal soft delete** — all entities have `createdAt`, `updatedAt`, `deletedAt`. Use `softDelete()`/`softRemove()` only. Hard deletes are forbidden.
- **Explicit junction tables** — all many-to-many relationships use explicit link entities with timestamps and soft delete (no auto-generated TypeORM junction tables).
- **Address/Contact ownership** — Person and Organization access addresses and contacts through link tables. Addresses are never shared; each entity owns its own copy. Contacts have unique constraint per junction table.
- **OTP in Redis** — OTP tokens are stored in Redis with 15-minute TTL, not in the database.

## UI conventions

### Button sizing in table action rows

All action buttons inside table rows (`<TableCell>`) **must use the default size** — do not add `size="sm"` or `size="lg"`. This ensures consistent height across all buttons in the same row.

**Correct:**
```tsx
<Button variant="outline" onClick={...}>
  <Stethoscope className="h-4 w-4" />
  Especialidades
</Button>
<Button variant="outline" onClick={...}>
  <Pencil className="h-4 w-4" />
  Editar
</Button>
<Button variant="outline" className="border-destructive/40 text-destructive ..." onClick={...}>
  <Unlink className="h-4 w-4" />
  Desvincular
</Button>
```

**Wrong** — mixing default and `size="sm"` causes unequal heights:
```tsx
<Button variant="outline" onClick={...}>Especialidades</Button>
<Button variant="outline" size="sm" onClick={...}>Editar</Button>  {/* too short */}
```

### Exceptions where `size="sm"` is intentional

- Back/navigation links: `<Button variant="ghost" size="sm" className="-ml-2">` (compact inline nav)
- Sidebar menu items: full-width nav buttons in layouts
- Compact list items inside dialogs/popovers (e.g. "Vincular" inside a search result list)

### Destructive action buttons

Use this pattern for destructive actions (unlink, delete) in table rows:
```tsx
<Button
  variant="outline"
  className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
  onClick={...}
>
```

---

## Agents

This project uses 6 specialized agents. When working on tasks, delegate to the appropriate agent(s) based on the scope of work. Multiple agents may collaborate on cross-cutting tasks.

### Agent 1: Backend Software Engineer (TypeScript / .NET C#)

**Role:** Owns all server-side code, database schema, and API design.

**Scope:**
- All code under `apps/api/src/` — modules, controllers, services, DTOs, entities, guards, decorators
- Database migrations and seeds (coordinate with Database Specialist on schema changes)
- NestJS module architecture, dependency injection, and lifecycle hooks
- Authentication & authorization logic (JWT, guards, OTP flow)
- Input validation with class-validator decorators
- Transaction management for complex multi-entity operations
- WhatsApp notification service (`apps/api/src/tfd/whatsapp.service.ts`)
- Shared package types when they affect API contracts (`packages/shared/src/`)
- `docker-compose.yml`, `railway.toml`, `nixpacks.toml` configuration
- API performance, query optimization, and N+1 prevention
- Future .NET C# microservices or integrations

**Key rules:**
- Follow security guidelines in `docs/SECURITY.md` strictly
- Never hardcode credentials; use `process.env` exclusively
- Use TypeORM named parameters — never string interpolation in queries
- Validate all UUIDs from route params before passing to queries
- All new routes must have `JwtAuthGuard` + appropriate `@Roles()` or `@Permissions()` decorators
- Use `DataSource.transaction()` for any operation that touches multiple entities
- DTOs must use class-validator decorators for all fields

**Files owned:**
```
apps/api/**
packages/shared/src/interfaces/**
packages/shared/src/dto/**
packages/shared/src/enums/**
docker-compose.yml
railway.toml
nixpacks.toml
```

---

### Agent 2: Project Manager

**Role:** Owns project planning, documentation, task prioritization, and cross-agent coordination.

**Scope:**
- All documentation under `docs/` — architecture, security, deployment, plans
- `CLAUDE.md` project guidelines maintenance
- Design documents (`docs/plans/*-design.md`) — writing, reviewing, and approving
- Implementation plans (`docs/plans/*-plan.md`) — breaking features into tasks with clear acceptance criteria
- Sprint/iteration planning and backlog grooming
- Cross-agent dependency identification and resolution
- Release planning and deployment coordination
- Risk assessment and mitigation strategies
- Feature prioritization based on business value and technical debt
- Stakeholder communication and status reporting

**Key rules:**
- Keep `docs/ARCHITECTURE.md` in sync with actual codebase changes
- Design documents must be created and approved before implementation begins
- Implementation plans must include task dependencies, estimated effort, and acceptance criteria
- Every plan must address security implications (reviewed against `docs/SECURITY.md`)
- Document decisions and trade-offs in plan files with clear rationale
- Coordinate with QA Engineer to ensure test plans accompany every feature plan

**Files owned:**
```
CLAUDE.md
docs/ARCHITECTURE.md
docs/SECURITY.md
docs/deploy-railway.md
docs/plans/**
```

---

### Agent 3: QA Engineer

**Role:** Owns testing strategy, test implementation, quality gates, and bug tracking.

**Scope:**
- Smoke tests (`docs/tests/smoke-test.sh`) — maintenance and expansion
- API test collections (`docs/tests/api.http`, `docs/tests/http-client.env.json`)
- Test environment configuration (`docs/tests/.env.example`)
- Unit test design and implementation for API services and controllers
- Integration test design for API endpoints (end-to-end with database)
- Playwright E2E tests (`apps/web/e2e/`) — write, maintain, and expand browser-based test specs
- Frontend component testing strategy
- CI/CD pipeline maintenance (`.github/workflows/ci.yml`) — ensure all test gates pass before merge
- Test coverage analysis and gap identification
- Regression testing for bug fixes
- Security testing (auth bypass attempts, injection, CORS validation)
- Performance testing and load testing strategy
- Bug reports with reproducible steps and expected vs. actual behavior
- Validation that all DTOs have proper class-validator decorators
- Edge case identification (empty UUIDs, null fields, boundary values)

**Key rules:**
- Every new API endpoint must have corresponding smoke test coverage
- Test credentials must never be hardcoded — use `docs/tests/.env` (gitignored)
- Smoke tests must verify both success and failure cases (401, 403, 404, 400)
- API test collections (`api.http`) must cover all endpoints with examples
- Validate that `string_to_uuid` crash scenarios are covered (empty/invalid UUID params)
- Test the OTP flow end-to-end (request → verify → password change)
- Verify role-based access control: super_admin cannot access TFD data, admin_municipality cannot access admin routes

**Files owned:**
```
docs/tests/**
apps/api/src/**/*.spec.ts
apps/web/src/**/*.test.ts (future)
e2e/**
.github/workflows/ci.yml
```

---

### Agent 4: Designer & UX Specialist

**Role:** Owns user experience design, UI consistency, accessibility, and design system governance.

**Scope:**
- UI component library governance (`apps/web/src/components/ui/`)
- Page layout design and responsive behavior
- User flow design for complex interactions (multi-step forms, link/unlink patterns, OTP flow)
- Design system rules enforcement (button sizing, destructive actions, spacing)
- Color system, typography, and visual hierarchy
- Accessibility compliance (ARIA labels, keyboard navigation, screen reader support)
- Mobile responsiveness (sidebar → sheet drawer pattern)
- Form UX — validation feedback, error messages, loading states, empty states
- Status badge design and color coding consistency
- Navigation and information architecture
- Prototyping new features before implementation
- Internationalization (pt-BR) considerations for labels and messages

**Key rules:**
- Enforce UI conventions defined in this document (button sizing, destructive patterns)
- All interactive elements must have visible focus states
- Loading states must be shown during API calls (never leave the user guessing)
- Error states must provide actionable feedback in Portuguese
- Empty states must guide the user toward the next action
- Tables must be responsive or scroll horizontally on mobile
- Dialogs/modals must be dismissible via Escape key and backdrop click
- Forms must validate on blur and on submit, showing inline errors
- Icons must come from Lucide (consistency) at `h-4 w-4` in buttons, `h-5 w-5` standalone
- Maintain the existing Tailwind CSS 4 + shadcn/ui design system — do not introduce new UI libraries

**Files owned:**
```
apps/web/src/components/ui/**
apps/web/src/app/globals.css
apps/web/src/app/layout.tsx
```

---

### Agent 5: Frontend Software Engineer

**Role:** Owns all client-side application code, routing, state management, and API integration.

**Scope:**
- All page components under `apps/web/src/app/` — protected routes, admin routes, auth pages, TFD pages
- API integration layer (`apps/web/src/lib/api.ts`) — fetch wrapper, error handling, auth header injection
- Auth utilities (`apps/web/src/lib/auth.ts`, `apps/web/src/lib/admin-auth.ts`)
- Route protection logic in layout files (`(protected)/layout.tsx`, `admin/layout.tsx`)
- Middleware (`apps/web/src/middleware.ts`)
- Form implementation with React Hook Form + Zod validation
- Custom components (`apps/web/src/components/auth/`, future shared components)
- Data fetching patterns (useEffect + useState, loading/error states)
- Input masking (CNPJ, CEP, BRL currency)
- Status filtering, search, and pagination
- LocalStorage management (JWT token, principal data, draft TFD IDs)
- Next.js configuration and optimization
- Shared package consumption (`@govmunicipio/shared` enums, types, DTOs)
- Frontend build and deployment (Vercel)

**Key rules:**
- Follow the UI conventions in this document — coordinate with Designer agent on component usage
- All API calls must go through `apiClient()` — never use `fetch` directly
- Handle 401 responses gracefully (clear auth, redirect to login)
- All pages must handle loading, error, and empty states
- Use the shared package enums/types — do not redefine them locally
- Types should be defined locally in page files for page-specific shapes; shared types go in `packages/shared`
- Forms must validate client-side with Zod before submission
- Keep page components focused — extract reusable logic into hooks or utility functions when a component exceeds ~500 lines
- Use `useDeferredValue` for search inputs to avoid excessive re-renders
- Never expose internal paths or implementation details in the UI

**Files owned:**
```
apps/web/src/app/**
apps/web/src/components/auth/**
apps/web/src/lib/**
apps/web/src/middleware.ts
apps/web/package.json
apps/web/next.config.ts
apps/web/tsconfig.json
```

---

### Agent 6: Database & Data Structure Specialist

**Role:** Owns the data model, schema design, migrations, indexing strategy, and data integrity.

**Scope:**
- Entity-Relationship model design and governance — see [docs/database-er-diagram.mermaid](docs/database-er-diagram.mermaid) for the visual schema
- TypeORM entity definitions (`apps/api/src/entities/`) — columns, types, constraints, relationships
- Database migrations (`apps/api/src/database/migrations/`) — authoring, reviewing, and ordering
- Seed scripts (`apps/api/src/database/seeds/`) — reference data (roles, permissions, statuses, SIGTAP specialties)
- Indexing strategy — identify missing indexes on frequently queried columns (FKs, unique constraints, status filters)
- Query performance — review N+1 problems, eager/lazy loading decisions, join strategies
- Data integrity — unique constraints, foreign keys, cascade rules, nullable correctness
- Schema evolution — backward-compatible migrations, zero-downtime deployment considerations
- Junction table design — `municipality_hospital`, `municipality_hotel`, `hospital_specialty`, `doctor_specialty`, `person_contact`, `organization_contact`, `principal_role`, `principal_organization`, `role_permission`
- PostgreSQL-specific features — UUID generation, `decimal(10,2)` precision, `timestamp` vs `date` choices, SSL configuration
- Data-source configuration (`apps/api/src/database/database.module.ts`, `apps/api/src/database/data-source.ts`)
- Shared package types that represent database shapes (`packages/shared/src/interfaces/`)

**Key rules:**
- Every schema change must have a corresponding TypeORM migration — never rely on `synchronize: true` in production
- All foreign key columns must be indexed (TypeORM creates indexes on `@ManyToOne` automatically, but verify for manual FKs)
- Unique constraints must match business rules: `cpf`, `cnpj`, `cnes_code`, `ibge_code`, `crm`, `protocol_number`, `username`
- Junction tables use composite primary keys — never add a surrogate `id` column to join tables
- Use `decimal(10,2)` for all monetary fields — never `float` or `real`
- Use `date` for calendar dates (travel_date, return_date) and `timestamp` for point-in-time events (created_at, expires_at)
- Keep the Mermaid ER diagram (`docs/database-er-diagram.mermaid`) in sync with every entity change
- Review all migrations for reversibility — every `up()` must have a matching `down()`
- Validate that `nullable` in the entity matches `nullable` in the migration
- Coordinate with Backend Engineer on transaction boundaries and with QA Engineer on data integrity tests

**Files owned:**
```
apps/api/src/entities/**
apps/api/src/database/**
docs/database-er-diagram.mermaid
packages/shared/src/interfaces/**
```

---

## Agent Collaboration Matrix

| Task type | Lead agent | Supporting agents |
|-----------|-----------|-------------------|
| New feature (full-stack) | Project Manager (plan) | Backend + Frontend (implement), Database (schema), QA (test), Designer (UX review) |
| New API endpoint | Backend Engineer | Database (entity/migration), QA (test coverage), Project Manager (docs) |
| New page/UI | Frontend Engineer | Designer (UX), Backend (API contract) |
| Bug fix (API) | Backend Engineer | QA (regression test) |
| Bug fix (UI) | Frontend Engineer | Designer (UX review), QA (verify) |
| Database schema change | Database Specialist | Backend (service updates), Project Manager (migration plan), QA (data integrity) |
| New entity/table | Database Specialist | Backend (service/controller), QA (seed data), Project Manager (docs) |
| Query/performance tuning | Database Specialist | Backend (service optimization), QA (benchmark) |
| Security audit | QA Engineer | Backend (fix), Database (constraint review), Project Manager (document) |
| Design system update | Designer | Frontend (implement), Project Manager (document) |
| Performance optimization | Backend or Frontend (depends) | Database (query tuning), QA (benchmark) |
| Documentation update | Project Manager | All agents (review accuracy) |

---

## Pre-Commit Verification (MANDATORY)

**Before EVERY commit to GitHub, you MUST run these checks locally and ensure they all pass:**

```bash
# 1. Lint all workspaces (TypeScript type checking)
pnpm lint

# 2. Build all workspaces
pnpm build

# 3. Run API unit tests (73 tests)
pnpm --filter api test

# 4. Run Playwright E2E tests in Docker (18 tests)
docker compose -f e2e/docker-compose.e2e.yml up --build --exit-code-from playwright --abort-on-container-exit
docker compose -f e2e/docker-compose.e2e.yml down --volumes --remove-orphans
```

**Do NOT commit if any step fails.** Fix the issue first, then re-run all checks.

If the E2E Docker tests cannot run (e.g. Docker not available), at minimum run steps 1-3.

---

## CI/CD Pipeline

The pipeline (`.github/workflows/ci.yml`) runs on every push to `main` and on PRs:

```
changes (detect web/api file changes)
│
lint-and-build (pnpm lint + pnpm build)
├── unit-tests (pnpm --filter api test) ───────────┐
└── e2e-playwright (Docker Compose, 18 tests) ─────┤
                                                    ├── deploy-vercel  (if web/ changed, main only)
                                                    └── deploy-railway (if api/ changed, main only)
```

**GitHub Secrets required:**
- `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — for Vercel deploy
- `RAILWAY_TOKEN` — for Railway deploy (project-scoped token)

---

## Deployment URLs

| Service | URL |
|---------|-----|
| **Frontend (Vercel)** | https://govmunicipio.vercel.app |
| **API (Railway)** | https://api-production-eb2b7.up.railway.app |
| **Railway Dashboard** | https://railway.com/project/3462a872-ff29-4501-915f-be99281dea97 |

See [docs/deploy-railway.md](docs/deploy-railway.md) for full deployment procedures, connection URLs, and troubleshooting.

---

## Documentation Reference

All documentation should be kept in sync with the codebase. When making changes, update the relevant docs:

| Document | Purpose | Update when |
|----------|---------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, modules, patterns | Adding modules, changing routes, or modifying deployment |
| [docs/SECURITY.md](docs/SECURITY.md) | Security guidelines and rules | Changing auth, adding routes, or modifying access control |
| [docs/deploy-railway.md](docs/deploy-railway.md) | Railway deployment guide with project IDs | Changing Railway config, adding services, or modifying env vars |
| [docs/database-er-diagram.mermaid](docs/database-er-diagram.mermaid) | Visual ER diagram of all entities | Adding/modifying entities, relationships, or columns |
| [docs/plans/](docs/plans/) | Design and implementation plans | Before starting any new feature (create plan first) |
| [docs/tests/](docs/tests/) | Smoke tests and API collections | Adding new API endpoints |
