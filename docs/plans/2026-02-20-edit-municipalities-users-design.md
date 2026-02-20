# Edit Municipalities & Users — Design Document

## Goal

Enable superadmin to edit municipalities and users. Enable admin_municipality to manage users of their own municipality from the dashboard.

## Architecture

Two new route groups on the API:
- **`/admin/*`** (existing, extended) — superadmin edits municipality and user
- **`/municipality/*`** (new) — admin_municipality manages their own org's users

Frontend changes:
- `/admin/municipalities` — add Edit button → modal
- `/admin/users` — add Edit button → modal
- `/dashboard` sidebar — add "Usuários" link visible only to `admin_municipality`
- `/dashboard/users` (new page) — user list + modal for create/edit

## API Design

### PATCH /admin/municipalities/:id
**Guard:** `super_admin`

Updates Organization (name, cnpj, isActive) + Address (city, state, street, number, neighborhood, zipCode) + Municipality (ibgeCode, state).

DTO: `UpdateMunicipalityDto` — all fields optional.

### PATCH /admin/users/:id
**Guard:** `super_admin`

Updates Person (firstName, lastName), PersonIdentification (cpf), Principal (username, passwordHash if password provided, isActive), and Role assignments (replaces existing roles).

DTO: `UpdateUserDto` — all fields optional; password only hashed+saved if provided.

### GET /municipality/users
**Guard:** `admin_municipality`

Returns principals whose `organizations` array contains the caller's `organizationId` (from JWT). Excludes `super_admin` role users.

### POST /municipality/users
**Guard:** `admin_municipality`

Creates a new user scoped to the caller's organization. Allowed roles: `admin_municipality`, `operator_tfd`, `viewer` (blocks `super_admin`).

### PATCH /municipality/users/:id
**Guard:** `admin_municipality`

Same as POST but updates existing user. Validates that the target principal belongs to the caller's organization before updating.

## Frontend Design

### /admin/municipalities — Edit modal
- Table row: add "Editar" button (pencil icon)
- Modal title: "Editar Município"
- Fields: Nome, CNPJ, Cód. IBGE, Cidade, UF, Rua, Número, Bairro, CEP, Status toggle (Ativo/Inativo)
- On save: `PATCH /admin/municipalities/:id`, refresh list, close modal

### /admin/users — Edit modal
- Table row: add "Editar" button
- Modal title: "Editar Usuário"
- Fields: Nome, Sobrenome, CPF, Username, Senha (optional — leave blank to keep), Roles (checkboxes), Status toggle
- On save: `PATCH /admin/users/:id`, refresh list, close modal

### /dashboard sidebar
- Add "Usuários" link to sidebar, rendered conditionally if `isAdminMunicipality()` (reads roles from localStorage)
- New helper: `isAdminMunicipality(): boolean` in `apps/web/src/lib/admin-auth.ts`

### /dashboard/users (new page)
- Table: Username, Nome, Role, Status
- "Novo Usuário" button → create modal
- Table row: "Editar" button → edit modal
- Modal fields: Nome, Sobrenome, CPF, Username, Senha, Role (select: Admin Municipal / Operador TFD / Visualizador), Status toggle
- Create: `POST /municipality/users`
- Edit: `PATCH /municipality/users/:id`

## Data Flow

```
superadmin edits municipality
  → PATCH /admin/municipalities/:id
  → AdminService.updateMunicipality(id, dto)
  → Updates organization, address, municipality in transaction

admin_municipality creates user
  → POST /municipality/users
  → MunicipalityService.createUser(dto, organizationId from JWT)
  → Validates role not super_admin
  → Creates Person + PersonIdentification + Principal in transaction
  → Assigns org to principal.organizations
```

## Files to Create/Modify

### API
- `apps/api/src/admin/dto/update-municipality.dto.ts` (new)
- `apps/api/src/admin/dto/update-user.dto.ts` (new)
- `apps/api/src/admin/admin.service.ts` (add updateMunicipality, updateUser)
- `apps/api/src/admin/admin.controller.ts` (add PATCH endpoints)
- `apps/api/src/municipality/dto/create-municipality-user.dto.ts` (new)
- `apps/api/src/municipality/municipality.service.ts` (new)
- `apps/api/src/municipality/municipality.controller.ts` (new)
- `apps/api/src/municipality/municipality.module.ts` (new)
- `apps/api/src/app.module.ts` (register MunicipalityModule)

### Frontend
- `apps/web/src/lib/admin-auth.ts` (add isAdminMunicipality helper)
- `apps/web/src/app/admin/municipalities/page.tsx` (add edit modal)
- `apps/web/src/app/admin/users/page.tsx` (add edit modal)
- `apps/web/src/app/dashboard/layout.tsx` (add conditional Usuários link)
- `apps/web/src/app/dashboard/users/page.tsx` (new)
