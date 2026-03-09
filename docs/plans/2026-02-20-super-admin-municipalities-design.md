# Design: Super Admin and Municipality Management

**Date:** 2026-02-20
**Status:** Approved

---

## Context

The current system has only one `admin` user with the `admin_municipality` role linked to the municipality of Camaçari. There is no global platform administrator, nor any screens for creating municipalities and their administrators.

This document describes the addition of:
1. A global `superadmin` user (not linked to any municipality)
2. An `admin` module in the backend with management endpoints
3. An `/admin` area in the frontend with its own layout

---

## Decisions

| Decision | Choice |
|---------|---------|
| super_admin layout | Separate `/admin` area with its own layout |
| Creation flow | Municipality + first admin in a single form/endpoint |
| Implementation approach | Separate `admin` module (A) with onboarding endpoint (C) |

---

## 1. Seed

The existing `seed.ts` creates `admin` (admin_municipality). A second block will be added:

- `Person`: firstName="Admin", lastName="Sistema"
- `Principal`: username=`superadmin`, password=`superadmin123`
- Role: `super_admin` (already exists)
- `organization = null` — not linked to any municipality
- Resulting JWT: `{ sub, organizationId: '', roles: ['super_admin'], permissions: [...] }`

New permissions will also be added to the seed and to the `super_admin` role:
- `municipality:create`
- `municipality:read`
- `principal:create`
- `principal:read`

---

## 2. Backend — Admin Module

### Structure

```
apps/api/src/admin/
  admin.module.ts
  admin.controller.ts
  admin.service.ts
  dto/
    create-municipality.dto.ts
```

### Guards

All endpoints in the `admin` module require:
- `JwtAuthGuard` (valid token)
- `RolesGuard` with `@Roles('super_admin')`

### Endpoints

| Method | Route | Description |
|--------|------|-----------|
| GET | `/admin/municipalities` | List all municipalities with organization |
| POST | `/admin/municipalities` | Create municipality + admin (atomic transaction) |
| GET | `/admin/municipalities/:id` | Municipality detail |
| GET | `/admin/users` | List all principals with roles and organization |

### DTO `CreateMunicipalityDto`

```typescript
class MunicipalityDataDto {
  name: string;       // municipality hall name
  cnpj: string;
  ibgeCode: string;
  state: string;      // state code (2 chars)
  city: string;
  street: string;
  number: string;
  neighborhood?: string;
  zipCode?: string;
}

class AdminDataDto {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  cpf: string;
}

class CreateMunicipalityDto {
  municipality: MunicipalityDataDto;
  admin: AdminDataDto;
}
```

### Creation transaction (`POST /admin/municipalities`)

1. `Address` — from address data
2. `Organization` — name, cnpj, isActive=true, address
3. `Municipality` — ibgeCode, state, organization
4. `Person` — firstName, lastName, gender=NOT_INFORMED
5. `PersonIdentification` — cpf, person
6. `Principal` — username, passwordHash, person, organization=orgEntity
7. `principal.roles = [admin_municipality]`
8. `principal.organizations = [orgEntity]`
9. Commit transaction

---

## 3. Frontend — `/admin` Area

### Route structure

```
apps/web/src/app/admin/
  layout.tsx             ← verifies super_admin role, own layout
  page.tsx               ← redirect to /admin/municipalities
  municipalities/
    page.tsx             ← municipalities list (table)
    new/
      page.tsx           ← 2-step form
  users/
    page.tsx             ← principals list (read-only)
```

### `/admin` Layout

- Dedicated sidebar with links: **Municipalities** and **Users**
- Header with "GovMunicípio — Platform Administration"
- Protection: reads JWT token from localStorage, checks `roles.includes('super_admin')`, otherwise redirects to `/dashboard`

### Municipalities Screen (`/admin/municipalities`)

- Table with columns: Name, CNPJ, State, IBGE Code, Active
- "New Municipality" button

### New Municipality Form (`/admin/municipalities/new`)

**Step 1 — Municipality Data:**
- Municipality hall name, CNPJ, IBGE Code, State
- Address: street, number, neighborhood, zip code, city

**Step 2 — First Administrator:**
- Username, Password, First Name, Last Name, CPF

Submission: `POST /admin/municipalities` with both data sets.

### Users Screen (`/admin/users`)

- Table with columns: Username, Name, Roles, Organization, Active
- Read-only (user CRUD may be added in a future iteration)

---

## 4. Access Control

The `super_admin` without an `organizationId` must not access TFD data (which is filtered by `organizationId`). Conversely, `admin_municipality` must not access `/admin`.

The `super_admin` role check on the frontend is performed by the `/admin/layout.tsx` via JWT claims. On the backend, `RolesGuard` validates the role in the token.

---

## Deliverables

1. `seed.ts` — superadmin block + new permissions
2. `apps/api/src/admin/` — module with 4 endpoints
3. `apps/web/src/app/admin/` — 4 pages with dedicated layout
