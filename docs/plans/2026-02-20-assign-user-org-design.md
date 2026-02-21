# Assign Organization to User — Design

**Date:** 2026-02-20

**Goal:** Allow superadmin to assign or remove a user's organization via a searchable combobox in the edit user modal.

**Constraint:** A user has 0 or 1 organization. Assigning a new org replaces the previous one.

---

## Architecture

### API

**`apps/api/src/admin/dto/update-user.dto.ts`**

Add an optional, nullable `organizationId` field:

```typescript
@IsOptional()
@ValidateIf((o) => o.organizationId !== null)
@IsUUID()
organizationId?: string | null;
```

Semantics:
- `undefined` → no change (current behavior preserved)
- `null` → remove organization from user
- UUID string → assign user to that organization

**`apps/api/src/admin/admin.service.ts` — `updateUser` method**

Inside the existing transaction, handle `organizationId`:
- If `null`: set `organization` (OneToOne) to null, set `organizations` (ManyToMany) to `[]`
- If UUID: find `OrganizationEntity` by id (throw 404 if not found), set `organization` to the entity, set `organizations` to `[entity]`
- Uses `manager` (transactional) for all DB operations

---

### Frontend

**New shadcn components to install:**
- `command` (`cmdk` library)
- `popover` (`@radix-ui/react-popover`)

Install via: `pnpm dlx shadcn@latest add command popover`

**`apps/web/src/app/admin/users/page.tsx`**

Changes:
1. Update `Principal` interface: `organizations: { id: string; name: string }[]`
2. Add `organizationId: string | null` to `EditForm`
3. On modal open (`openEdit`): pre-populate `organizationId` from `u.organizations[0]?.id ?? null`; fetch `/admin/municipalities` lazily (only when not yet loaded)
4. Add `municipalities` state: `{ orgId: string; label: string }[]` where `label = "Nome — Cidade/UF"`
5. Add Combobox (Command + Popover) in the dialog form:
   - Fixed first option: "Sem organização" (value `null`)
   - Remaining options: one per municipality, label = `"${org.name} — ${address.city}/${state}"`
   - Value stored = `organization.id` (not municipality.id)
   - Shows current selection in the trigger button
6. In `handleSave`: include `organizationId` in the PATCH body only when it differs from the original value (`editing.organizations[0]?.id ?? null`)

---

## Data Flow

```
Modal opens
  → openEdit(u) sets organizationId = u.organizations[0]?.id ?? null
  → if municipalities not loaded: GET /admin/municipalities → build options list

User types in combobox → filters options client-side (no extra API calls)

User selects org (or "Sem organização")
  → form.organizationId updated

User clicks Salvar
  → PATCH /admin/users/:id with { ..., organizationId } (only if changed)
  → API updates both organization (OneToOne) and organizations (ManyToMany)
  → Toast + reload list
```

---

## Error Handling

- Organization not found (UUID no longer valid) → API returns 404, toast shows the error message
- Invalid UUID sent → API returns 400 via class-validator
- Municipalities list fails to load → combobox shows empty list, user can still save other fields

---

## UI Sketch

```
Organização
┌────────────────────────────────────────┐
│ Prefeitura de Camaçari — Camaçari/BA ▾ │
└────────────────────────────────────────┘
  ┌──────────────────────────────────────┐
  │ 🔍 Buscar município...               │
  ├──────────────────────────────────────┤
  │   Sem organização                    │
  │ ✓ Prefeitura de Camaçari — Camaçari  │
  │   Prefeitura de Salvador — Salvador  │
  └──────────────────────────────────────┘
```
