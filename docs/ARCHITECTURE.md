# GovMunicípio — Architecture Reference

This document describes the current system architecture as implemented in the codebase.

---

## Overview

GovMunicípio is a healthcare transportation management platform (TFD — Tratamento Fora de Domicílio) that enables municipalities to manage patient transport requests, hospitals, hotels, doctors, and administrative users.

---

## Monorepo Structure

```
govmunicipio/
├── apps/
│   ├── api/          NestJS 11 REST API (TypeScript)
│   └── web/          Next.js 16 App Router frontend (TypeScript)
├── packages/
│   └── shared/       Shared interfaces, enums, and DTOs
├── docs/             Documentation, plans, and test files
├── e2e/              Maestro E2E test flows and scripts
│   ├── flows/        YAML test flows by feature area
│   └── scripts/      Test runner scripts
├── .github/workflows/ CI/CD pipeline (GitHub Actions)
├── turbo.json        Turborepo pipeline config
├── pnpm-workspace.yaml
├── docker-compose.yml   Local dev services (PostgreSQL 16, Redis 7)
├── railway.toml         Railway production config
└── nixpacks.toml        Build environment (Node.js 22)
```

**Tooling:** Turborepo + pnpm workspaces, TypeScript 5, Node.js 22.

---

## Backend (apps/api)

### Framework & Dependencies

NestJS 11, TypeORM 0.3, PostgreSQL (pg), Redis (ioredis), Passport + JWT, bcryptjs, class-validator, class-transformer.

### Global Configuration

- API prefix: `/api/v1`
- Global `ValidationPipe` with whitelist, forbidNonWhitelisted, and transform enabled
- CORS configured via `CORS_ORIGIN` env var
- Default port: 3001

### Modules

| Module | Route Prefix | Guard | Description |
|--------|-------------|-------|-------------|
| `AppModule` | `/` | None | Health check endpoint |
| `AuthModule` | `/auth` | Mixed | Login, JWT issuance, OTP password reset |
| `AdminModule` | `/admin` | `@Roles('super_admin')` | Full CRUD for municipalities, hospitals, hotels, organizations, users, specialties, doctors |
| `MunicipalityModule` | `/municipality` | `@Roles('admin_municipality')` | Scoped management of users, hospitals, hotels, pickup addresses (linked to caller's org) |
| `OrganizationModule` | `/` (root) | `@Permissions(...)` | Cross-cutting endpoints: hospitals list, doctor search/create, specialties list |
| `PersonModule` | `/persons` | `@Permissions(...)` | Person search (CPF/SUS) and creation |
| `TfdModule` | `/tfd/requests` | `@Permissions(...)` | TFD request lifecycle: create draft, update, submit, status change, cost update, stats |
| `DatabaseModule` | — | — | TypeORM connection, migrations, SSL config |
| `RedisModule` | — | — | Global ioredis client provider (`REDIS_CLIENT`) |

### Entities (30 concrete + 1 abstract base)

> **Visual schema:** See [database-er-diagram.mermaid](database-er-diagram.mermaid) for the full ER diagram with all columns, types, and relationships.

**Core:** `PrincipalEntity` (user account), `PersonEntity`, `PersonIdentificationEntity` (CPF/RG/SUS), `AddressEntity`, `ContactEntity`

**Organization:** `OrganizationEntity`, `MunicipalityEntity`, `HospitalEntity`, `HotelEntity`

**Medical:** `SpecialtyEntity` (SIGTAP procedures), `DoctorEntity`

**TFD:** `TfdRequestEntity` (the main business object), `PickupAddressEntity`

**System:** `RoleEntity`, `PermissionEntity`, `StatusEntity`, `ModuleEntity`, `ModuleStatusEntity`, `NotificationEntity`, `AuditLogEntity`

**Junction/Link (explicit, with timestamps):** `MunicipalityHospitalLinkEntity`, `MunicipalityHotelLinkEntity`, `PersonAddressLinkEntity`, `OrganizationAddressLinkEntity`, `PersonContactLinkEntity`, `OrganizationContactLinkEntity`, `PrincipalRoleLinkEntity`, `PrincipalOrganizationLinkEntity`, `RolePermissionLinkEntity`, `HospitalSpecialtyLinkEntity`, `DoctorSpecialtyLinkEntity`

All concrete entities include `createdAt`, `updatedAt`, and `deletedAt` (soft delete) columns. Main entities extend an abstract `BaseEntity` with UUID primary key. Junction tables use composite primary keys.

### Authentication & Authorization

- JWT-based with `JwtAuthGuard` + `JwtStrategy` (passport-jwt)
- `RolesGuard` checks `@Roles()` decorator metadata
- `PermissionsGuard` checks `@Permissions()` decorator metadata (format: `resource:action`)
- JWT payload: `{ sub, organizationId, roles, permissions }`
- OTP flow for initial password setup (6-digit code, 15-min expiry, stored in Redis with TTL)

### Database

- Production: `DATABASE_URL` from Railway, SSL enabled, migrations auto-run, synchronize disabled
- Development: individual `DB_*` vars, no SSL, synchronize enabled
- 14+ migrations covering the full schema evolution
- 2 seed scripts (general + SIGTAP specialties)

### Redis

- OTP token storage with automatic TTL expiry (15 minutes)
- Global `RedisModule` provides `REDIS_CLIENT` injectable token
- Production: `REDIS_URL` env var; Development: `REDIS_HOST`/`REDIS_PORT` (defaults to `localhost:6379`)
- Docker Compose includes `redis:7-alpine` for local development

---

## Frontend (apps/web)

### Framework & Dependencies

Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui (Radix UI primitives), React Hook Form + Zod, Lucide icons, Sonner toasts.

### Route Structure

**Public routes:**
- `/auth/login` — Login form
- `/auth/set-password` — OTP verification + password creation

**Protected routes (`admin_municipality`):**
- `/dashboard` — Stats cards, recent TFD requests
- `/dashboard/hospitals` — Link/create hospitals for the municipality
- `/dashboard/hospitals/[id]/specialties` — Manage hospital specialties
- `/dashboard/hotels` — Link/create hotels
- `/dashboard/addresses` — Pickup addresses CRUD
- `/dashboard/users` — Municipality user management
- `/dashboard/organizations` — Create organizations
- `/tfd/requests` — List TFD requests with status filter
- `/tfd/requests/new` — Multi-step TFD request creation form
- `/tfd/requests/[id]` — TFD request detail view

**Admin routes (`super_admin`):**
- `/admin` — Admin dashboard with stats
- `/admin/municipalities` — Municipality CRUD
- `/admin/municipalities/new` — 2-step municipality + admin creation wizard
- `/admin/hospitals` — Global hospital CRUD
- `/admin/hospitals/[id]/specialties` — Manage hospital specialties
- `/admin/hotels` — Global hotel CRUD
- `/admin/organizations` — Global organization CRUD
- `/admin/specialties` — SIGTAP procedure management
- `/admin/users` — Global user management with OTP

### Auth (client-side)

- JWT stored in `localStorage`
- `apiClient()` auto-attaches Bearer token, handles 401 redirect
- `isAuthenticated()` checks token expiration
- `isSuperAdmin()` / `isAdminMunicipality()` role checks
- Protected layout redirects unauthenticated users to `/auth/login`

### State Management

No global store. Each page manages local state via `useState` + `useEffect` for data fetching. Forms use controlled inputs with local state objects.

### UI Components (shadcn/ui)

Badge, Button, Card, Command, Dialog, Form, Input, Label, Popover, Select, Separator, Sheet, Sonner, Table, Tabs.

---

## Shared Package (packages/shared)

### Interfaces

`IJwtPayload`, `IPrincipal`, `IPerson`, `IPersonIdentification`, `IOrganization`, `IMunicipality`, `IHospital`, `IHotel`, `ITfdRequest`

### Enums

`Gender` (MALE, FEMALE, OTHER, NOT_INFORMED), `ContactType` (PHONE, EMAIL, WHATSAPP, FAX, OTHER), `TransportType` (BUS, VAN, AMBULANCE, AIR, OWN_VEHICLE, OTHER), `TfdStatus` (DRAFT, PENDING, APPROVED, REJECTED, SCHEDULED, COMPLETED, CANCELLED)

### DTOs

`LoginDto`, `LoginResponseDto`, `CreateTfdRequestDto`

---

## Testing

### Unit Tests (API)

Jest + @nestjs/testing for service-level unit tests. Located in `apps/api/src/**/*.spec.ts`. Run with `pnpm --filter api test`. Covers AuthService, OtpService, TfdService, and AdminService.

### E2E Tests (Frontend — Maestro)

[Maestro](https://github.com/mobile-dev-inc/maestro) for browser-based E2E testing using declarative YAML flows. Located in `e2e/flows/` organized by feature area: auth, dashboard, tfd, admin, accessibility.

Prerequisites: Java 17+, Maestro CLI. Install with `curl -fsSL "https://get.maestro.mobile.dev" | bash`.

Run locally: `./e2e/scripts/run-e2e.sh`

See `e2e/README.md` for the full testing guide.

### Smoke Tests

Bash-based HTTP endpoint tests at `docs/tests/smoke-test.sh`. Cover all API endpoints with success and failure cases.

### CI/CD

GitHub Actions pipeline at `.github/workflows/ci.yml` runs three jobs on every PR: lint + build → unit tests → Maestro E2E tests. All three must pass before merge.

---

## Deployment

| Component | Platform | URL Pattern |
|-----------|----------|-------------|
| Frontend | Vercel | `https://govmunicipio.vercel.app` |
| API | Railway | `https://govmunicipio-api.up.railway.app` |
| Database | Railway PostgreSQL | Managed, injected via `DATABASE_URL` |

---

## Roles & Access Matrix

| Role | Route prefix | Capabilities |
|------|-------------|--------------|
| `super_admin` | `/admin/*` | Full platform CRUD: municipalities, hospitals, hotels, organizations, users, specialties, doctors |
| `admin_municipality` | `/dashboard/*`, `/tfd/*`, `/municipality/*` | Scoped to own municipality: manage users, link hospitals/hotels, manage TFD requests, pickup addresses |
| `operator_tfd` | `/tfd/*` | Create and manage TFD requests |
| `viewer` | `/tfd/*` (read-only) | View TFD requests and stats |

---

## Key Technical Patterns

1. **Transaction Management:** Complex create operations (municipality + admin, doctor + person) use `DataSource.transaction()` for atomicity
2. **Organization Scoping:** Municipality endpoints extract `organizationId` from JWT to scope all queries
3. **OTP Password Flow:** User creation returns an OTP code; recipient uses it at `/auth/set-password` to set their password. OTP codes are stored in Redis with 15-minute TTL (not in the database)
4. **TFD Lifecycle State Machine:** TFD requests follow a 5-status lifecycle: `draft → pending → in_transit → finalized`, with `cancelled` reachable from draft, pending, or in_transit. Valid transitions are enforced server-side via `VALID_TRANSITIONS` map. Draft allows full editing; pending allows partial editing (travel, costs, notes only); in_transit, finalized, and cancelled are read-only
5. **WhatsApp Notifications:** Fire-and-forget notifications sent on TFD submission via external API
6. **SIGTAP Specialties:** Medical procedure codes with automatic group classification based on code prefix
7. **Link/Unlink Pattern:** Municipalities link to existing hospitals/hotels via explicit junction entities rather than owning them directly
8. **Universal Soft Delete:** All entities use `deletedAt` column (never hard delete). TypeORM's `@DeleteDateColumn` automatically filters soft-deleted rows. No cascading deletes — all foreign keys use `onDelete: 'RESTRICT'`
9. **Explicit Junction Tables:** All many-to-many relationships use explicit link entities with `createdAt`, `updatedAt`, and `deletedAt` columns (no auto-generated TypeORM junction tables). This enables soft delete on links and full audit trail
10. **Address/Contact Ownership:** Persons and Organizations own addresses and contacts through link tables (`person_address`, `organization_address`, `person_contact`, `organization_contact`). Addresses are not shared — each entity gets its own copy. Contact uniqueness is enforced per junction table
