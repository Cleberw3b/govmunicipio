# TFD Request Lifecycle — Design & Implementation Plan

**Date:** 2026-03-23
**Status:** Implemented
**Lead Agent:** Project Manager
**Supporting Agents:** All 6 agents

---

## 1. Objective

Simplify the TFD request lifecycle to 5 statuses, enforce valid state transitions server-side, add context-aware action buttons on the detail page (status change + edit), and create a comprehensive test suite covering the full lifecycle. The goal is a clearer, more predictable workflow for municipal operators.

---

## 2. Current State Analysis

### Current Statuses (7)
| Code | Label | Sort | Used in code? |
|------|-------|------|---------------|
| `draft` | Rascunho | 1 | ✅ create(), submit() |
| `pending` | Pendente | 2 | ✅ submit(), getStats() |
| `approved` | Aprovado | 3 | ⚠️ getStats() only |
| `rejected` | Rejeitado | 4 | ❌ Never set programmatically |
| `scheduled` | Agendado | 5 | ❌ Never set programmatically |
| `completed` | Concluído | 6 | ❌ Never set programmatically |
| `cancelled` | Cancelado | 7 | ❌ Never set programmatically |

### Current Problems
1. **No state machine** — `updateStatus()` accepts any `statusId` with no validation
2. **Unused statuses** — `approved`, `rejected`, `scheduled` are never used in business logic
3. **No status-change UI** — Only a "Continuar" (edit) button shown for `draft`; no way to advance status from the dashboard
4. **Stats reference removed statuses** — `getStats()` counts `approved` which will be removed
5. **Edit only in draft** — Users cannot edit a `pending` request (only draft has the edit button)

---

## 3. Target State — Simplified 5-Status Lifecycle

### New Statuses
| Code | Label (pt-BR) | Sort | Color | Description |
|------|---------------|------|-------|-------------|
| `draft` | Rascunho | 1 | gray | Incomplete form, can be edited freely |
| `pending` | Pendente | 2 | yellow | Submitted and awaiting transport |
| `in_transit` | Em Trânsito | 3 | blue | Patient is being transported |
| `finalized` | Finalizado | 4 | green | Treatment/transport completed |
| `cancelled` | Cancelado | 5 | gray | Request cancelled at any point |

### Removed Statuses
| Code | Reason |
|------|--------|
| `approved` | Not needed — pending goes directly to in_transit |
| `rejected` | Not in the simplified flow |
| `scheduled` | Replaced by in_transit |
| `completed` | Replaced by finalized |

### State Transition Rules (Enforced Server-Side)

```
                    ┌──cancel──► cancelled
                    │
  draft ──submit──► pending ──start transport──► in_transit ──finish──► finalized
    │                  │                             │
    └──cancel──►       └──────cancel──►              └──cancel──► cancelled
              cancelled
```

| From | To | Action | Who can trigger |
|------|----|--------|-----------------|
| `draft` | `pending` | Submit (existing endpoint) | admin_municipality, operator_tfd |
| `draft` | `cancelled` | Cancel | admin_municipality, operator_tfd |
| `pending` | `in_transit` | Start transport | admin_municipality, operator_tfd |
| `pending` | `cancelled` | Cancel | admin_municipality, operator_tfd |
| `in_transit` | `finalized` | Finish | admin_municipality, operator_tfd |
| `in_transit` | `cancelled` | Cancel | admin_municipality, operator_tfd |
| `finalized` | — | Terminal state | — |
| `cancelled` | — | Terminal state | — |

### Edit Rules
| Status | Can Edit? | Can Change Status? |
|--------|-----------|--------------------|
| `draft` | ✅ Full edit | ✅ Submit or Cancel |
| `pending` | ✅ Partial edit (travel dates, costs, notes, addresses) | ✅ Start Transport or Cancel |
| `in_transit` | ❌ | ✅ Finish or Cancel |
| `finalized` | ❌ | ❌ |
| `cancelled` | ❌ | ❌ |

---

## 4. Implementation Tasks by Agent

### Agent 6: Database & Data Structure Specialist

**Task DB-1: Update status seed data**
- File: `apps/api/src/database/seeds/seed.ts`
- Replace the 7-status array with the new 5-status array
- Update ModuleStatus linkage accordingly
- Acceptance: Seed runs cleanly; 5 statuses in DB

**Task DB-2: Create migration to update statuses**
- File: `apps/api/src/database/migrations/XXXXXX-SimplifyTfdStatuses.ts`
- `up()`:
  1. Insert `in_transit` status (code='in_transit', label='Em Trânsito', sortOrder=3)
  2. Insert `finalized` status (code='finalized', label='Finalizado', sortOrder=4)
  3. Update any existing `tfd_request` rows with status `approved` → `pending`
  4. Update any existing `tfd_request` rows with status `scheduled` → `in_transit`
  5. Update any existing `tfd_request` rows with status `completed` → `finalized`
  6. Update any existing `tfd_request` rows with status `rejected` → `cancelled`
  7. Delete `module_status` rows for removed statuses
  8. Delete status rows: `approved`, `rejected`, `scheduled`, `completed`
  9. Insert `module_status` rows for `in_transit` and `finalized`
  10. Update `cancelled` sortOrder to 5
- `down()`: Reverse all operations
- Acceptance: Migration reversible; no orphaned FK references

**Task DB-3: Update ER diagram**
- File: `docs/database-er-diagram.mermaid`
- Update the StatusEntity section to show only 5 statuses
- Acceptance: Diagram matches the new status set

**Estimated effort:** Small — data-only change, no schema alteration

---

### Agent 1: Backend Software Engineer

**Task BE-1: Update TfdStatus enum**
- File: `packages/shared/src/enums/tfd-status.enum.ts`
- Remove: `APPROVED`, `REJECTED`, `SCHEDULED`, `COMPLETED`
- Add: `IN_TRANSIT = 'in_transit'`, `FINALIZED = 'finalized'`
- Acceptance: Enum has exactly 5 values

**Task BE-2: Add status transition validation to `updateStatus()`**
- File: `apps/api/src/tfd/tfd.service.ts`
- Add a `VALID_TRANSITIONS` map defining allowed transitions:
  ```typescript
  private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
    draft: ['cancelled'],          // submit handles draft→pending
    pending: ['in_transit', 'cancelled'],
    in_transit: ['finalized', 'cancelled'],
    finalized: [],                  // terminal
    cancelled: [],                  // terminal
  };
  ```
- In `updateStatus()`, validate that the target status code is in the allowed list for the current status code
- Throw `BadRequestException` with clear pt-BR message if invalid transition:
  `'Transição de status inválida: não é possível alterar de "{current}" para "{target}".'`
- Change `UpdateTfdStatusDto` to accept `statusCode` (string) instead of `statusId` (UUID) — more explicit, avoids UUID lookup errors
- Acceptance: Invalid transitions return 400; valid transitions succeed

**Task BE-3: Allow partial edit for pending requests**
- File: `apps/api/src/tfd/tfd.service.ts`
- Current `updateDraft()` allows editing any field — rename to `updateRequest()` and add status check:
  - If `draft`: allow all fields
  - If `pending`: allow only `travelDate`, `returnDate`, `pickupAddressId`, `returnPickupAddressId`, `departureCustomAddress`, `transportationCost`, `foodCost`, `hotelCost`, `notes`
  - Otherwise: throw `BadRequestException('Solicitação não pode ser editada neste status.')`
- Acceptance: Editing clinical data on a pending request returns 400

**Task BE-4: Update `getStats()` to use new statuses**
- File: `apps/api/src/tfd/tfd.service.ts`
- Replace `approved` count with `in_transit` count in the stats response
- Rename interface field from `approved` to `inTransit`
- Acceptance: Stats return correct counts for new statuses

**Task BE-5: Add `GET /tfd/requests/statuses` endpoint**
- File: `apps/api/src/tfd/tfd.controller.ts`
- New route that returns available statuses for the TFD module
- Used by frontend to populate filter dropdowns dynamically
- Permission: `tfd_request:read`
- Acceptance: Returns array of `{ id, code, label }` for the 5 statuses

**Task BE-6: Update `UpdateTfdStatusDto`**
- File: `apps/api/src/tfd/dto/update-tfd-status.dto.ts`
- Change from `statusId: UUID` to `statusCode: string` with `@IsIn(['in_transit', 'finalized', 'cancelled'])` validation
- Note: `draft→pending` still uses the existing `POST /:id/submit` endpoint
- Acceptance: DTO validates against allowed codes

**Estimated effort:** Medium — core business logic changes

---

### Agent 5: Frontend Software Engineer

**Task FE-1: Update shared enum imports**
- All files importing `TfdStatus` from `@govmunicipio/shared`
- Replace references to `APPROVED`, `REJECTED`, `SCHEDULED`, `COMPLETED` with `IN_TRANSIT`, `FINALIZED`
- Files affected:
  - `apps/web/src/app/(protected)/tfd/requests/page.tsx` (list page)
  - `apps/web/src/app/(protected)/tfd/requests/[id]/page.tsx` (detail page)
- Acceptance: No TypeScript compilation errors

**Task FE-2: Update status labels, colors, and filters on list page**
- File: `apps/web/src/app/(protected)/tfd/requests/page.tsx`
- Update `STATUS_OPTIONS` array to 5 statuses:
  - `all` | Todos
  - `draft` | Rascunho (gray)
  - `pending` | Pendente (yellow)
  - `in_transit` | Em Trânsito (blue)
  - `finalized` | Finalizado (green)
  - `cancelled` | Cancelado (gray)
- Update `STATUS_LABELS` and `getStatusClass()` accordingly
- Acceptance: Filter dropdown shows 5 options; badges render correct colors

**Task FE-3: Add context-aware action buttons to detail page**
- File: `apps/web/src/app/(protected)/tfd/requests/[id]/page.tsx`
- Replace the current "Continuar" button with a new action bar:

  | Current Status | Buttons Shown |
  |----------------|---------------|
  | `draft` | **Editar** (navigate to edit form) + **Cancelar** (red, with confirmation dialog) |
  | `pending` | **Iniciar Transporte** (blue) + **Editar** (secondary, navigate to edit) + **Cancelar** (red) |
  | `in_transit` | **Finalizar** (green) + **Cancelar** (red) |
  | `finalized` | No action buttons (show "Finalizado" badge only) |
  | `cancelled` | No action buttons (show "Cancelado" badge only) |

- Each status-changing button calls `PATCH /tfd/requests/:id/status` with `{ statusCode: 'target_code' }`
- All destructive actions (Cancel) require a `ConfirmDialog` confirmation
- Show loading spinner during API call
- After success: refetch the request data to update the UI
- Buttons only visible if user has `tfd_request:update` permission (check from principal stored in localStorage)
- Acceptance: All buttons work; confirmation dialog appears for cancel; UI updates after transition

**Task FE-4: Enable edit for pending requests**
- File: `apps/web/src/app/(protected)/tfd/requests/[id]/page.tsx`
- The "Editar" button should be visible for both `draft` and `pending` statuses
- When editing a `pending` request, the form should disable clinical/patient fields and only allow travel/cost fields
- File: `apps/web/src/app/(protected)/tfd/requests/new/page.tsx`
- Add URL param or localStorage flag to indicate "editing pending" mode
- Disable steps 1-4 (patient, companion, doctor, hospital, clinical data) in pending edit mode
- Acceptance: Editing a pending request only allows travel/cost fields

**Task FE-5: Update status labels and colors on detail page**
- File: `apps/web/src/app/(protected)/tfd/requests/[id]/page.tsx`
- Mirror the same `STATUS_LABELS` and `getStatusClass()` updates from FE-2
- Acceptance: Detail page badges match list page

**Estimated effort:** Medium-High — multiple UI components and state management

---

### Agent 4: Designer & UX Specialist

**Task UX-1: Review action button placement and styling**
- Validate that context-aware buttons follow the existing design system
- Ensure destructive buttons use the project's destructive pattern:
  ```tsx
  className="border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
  ```
- Primary forward actions (Iniciar Transporte, Finalizar) should use the default `Button` variant
- Edit button should use `variant="outline"`
- Acceptance: Consistent with existing UI conventions in CLAUDE.md

**Task UX-2: Design confirmation dialog for status changes**
- Use existing `ConfirmDialog` component from `apps/web/src/components/shared/`
- Messages in pt-BR:
  - Cancel: "Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita."
  - Start transport: "Confirma que o transporte do paciente foi iniciado?"
  - Finalize: "Confirma que o atendimento foi concluído?"
- Acceptance: All status changes have appropriate confirmation UX

**Task UX-3: Review mobile responsiveness of action bar**
- Buttons should stack vertically on small screens
- Use `flex-wrap gap-2` for the action bar container
- Acceptance: Buttons are usable on mobile viewports

**Estimated effort:** Small — review and specification only

---

### Agent 3: QA Engineer

**Task QA-1: Unit tests for status transition validation**
- File: `apps/api/src/tfd/tfd.service.spec.ts`
- Test cases:
  1. ✅ `draft` → `pending` (via submit)
  2. ✅ `draft` → `cancelled` (via updateStatus)
  3. ✅ `pending` → `in_transit`
  4. ✅ `pending` → `cancelled`
  5. ✅ `in_transit` → `finalized`
  6. ✅ `in_transit` → `cancelled`
  7. ❌ `draft` → `in_transit` (invalid — expect 400)
  8. ❌ `draft` → `finalized` (invalid — expect 400)
  9. ❌ `pending` → `draft` (invalid — expect 400)
  10. ❌ `pending` → `finalized` (invalid — expect 400)
  11. ❌ `in_transit` → `pending` (invalid — expect 400)
  12. ❌ `in_transit` → `draft` (invalid — expect 400)
  13. ❌ `finalized` → any (invalid — expect 400)
  14. ❌ `cancelled` → any (invalid — expect 400)
- Acceptance: All 14 test cases pass

**Task QA-2: Unit tests for partial edit rules**
- File: `apps/api/src/tfd/tfd.service.spec.ts`
- Test cases:
  1. ✅ Edit all fields when status is `draft`
  2. ✅ Edit travel/cost fields when status is `pending`
  3. ❌ Edit clinical fields when status is `pending` (expect 400 or fields ignored)
  4. ❌ Edit any field when status is `in_transit` (expect 400)
  5. ❌ Edit any field when status is `finalized` (expect 400)
  6. ❌ Edit any field when status is `cancelled` (expect 400)
- Acceptance: All 6 test cases pass

**Task QA-3: Update smoke tests**
- File: `docs/tests/smoke-test.sh`
- Add TFD lifecycle smoke test:
  1. Login as `admin`
  2. Create TFD request (expect draft status)
  3. Submit request (expect pending status)
  4. Update status to `in_transit` (expect success)
  5. Update status to `finalized` (expect success)
  6. Try to change finalized to pending (expect 400)
  7. Create another request, submit, then cancel (expect cancelled)
  8. Try to change cancelled to pending (expect 400)
- Acceptance: Smoke test passes end-to-end

**Task QA-4: Update API test collection**
- File: `docs/tests/api.http`
- Add status transition examples:
  ```http
  ### Start Transport
  PATCH {{baseUrl}}/tfd/requests/{{tfdId}}/status
  Content-Type: application/json
  Authorization: Bearer {{token}}
  { "statusCode": "in_transit" }

  ### Finalize
  PATCH {{baseUrl}}/tfd/requests/{{tfdId}}/status
  Content-Type: application/json
  Authorization: Bearer {{token}}
  { "statusCode": "finalized" }

  ### Cancel
  PATCH {{baseUrl}}/tfd/requests/{{tfdId}}/status
  Content-Type: application/json
  Authorization: Bearer {{token}}
  { "statusCode": "cancelled" }

  ### Invalid transition (expect 400)
  PATCH {{baseUrl}}/tfd/requests/{{tfdId}}/status
  Content-Type: application/json
  Authorization: Bearer {{token}}
  { "statusCode": "draft" }
  ```
- Acceptance: All examples documented with expected responses

**Task QA-5: E2E test — TFD lifecycle flow**
- File: `e2e/flows/tfd/tfd-lifecycle.yaml`
- Maestro flow:
  1. Login as admin user
  2. Navigate to TFD list page
  3. Click "Nova Solicitação"
  4. Fill in required fields (patient, doctor, hospital, clinical, travel)
  5. Submit the request
  6. Verify status badge shows "Pendente"
  7. Click "Iniciar Transporte" button
  8. Confirm in the dialog
  9. Verify status badge shows "Em Trânsito"
  10. Click "Finalizar" button
  11. Confirm in the dialog
  12. Verify status badge shows "Finalizado"
  13. Verify no action buttons are shown
- Acceptance: E2E flow passes in Docker

**Task QA-6: E2E test — TFD cancellation flow**
- File: `e2e/flows/tfd/tfd-cancel.yaml`
- Maestro flow:
  1. Login as admin user
  2. Create and submit a TFD request
  3. Click "Cancelar" button
  4. Confirm in the dialog
  5. Verify status shows "Cancelado"
  6. Verify no action buttons shown
- Acceptance: E2E flow passes in Docker

**Task QA-7: Permission tests**
- File: `docs/tests/smoke-test.sh` (extend)
- Test cases:
  1. `viewer` role → Cannot update status (expect 403)
  2. `operator_tfd` role → Can update status (expect 200)
  3. `admin_municipality` role → Can update status (expect 200)
  4. Unauthenticated → Cannot update status (expect 401)
- Acceptance: All role-based tests pass

**Task QA-8: Update `getStats()` tests**
- File: `apps/api/src/tfd/tfd.service.spec.ts`
- Update existing stats tests to use `inTransit` instead of `approved`
- Acceptance: Stats tests pass with new field name

**Estimated effort:** High — most test tasks, many cases to cover

---

### Agent 2: Project Manager

**Task PM-1: Update CLAUDE.md**
- Update the TFD status documentation in CLAUDE.md
- Add the new state transition diagram
- Update the API routes table if endpoints change
- Acceptance: CLAUDE.md reflects the new lifecycle

**Task PM-2: Update ARCHITECTURE.md**
- Add the new status flow diagram
- Document the state machine pattern
- Acceptance: Architecture docs are current

**Task PM-3: Review this plan and coordinate execution**
- Ensure all agents understand their dependencies
- Acceptance: Plan approved and work begins

**Estimated effort:** Small — documentation only

---

## 5. Execution Order & Dependencies

```
Phase 1 — Foundation (no dependencies)
├─ DB-1: Update seed data
├─ DB-2: Create migration
├─ BE-1: Update TfdStatus enum
└─ UX-1: Review button design

Phase 2 — Backend logic (depends on Phase 1)
├─ BE-2: Status transition validation
├─ BE-3: Partial edit for pending
├─ BE-4: Update getStats()
├─ BE-5: Statuses endpoint
└─ BE-6: Update DTO

Phase 3 — Frontend (depends on Phase 2)
├─ FE-1: Update enum imports
├─ FE-2: Update list page
├─ FE-3: Add action buttons to detail page
├─ FE-4: Enable edit for pending
└─ FE-5: Update detail page labels

Phase 4 — Testing (depends on Phase 3)
├─ QA-1: Unit tests for transitions
├─ QA-2: Unit tests for edit rules
├─ QA-3: Update smoke tests
├─ QA-4: Update API tests
├─ QA-5: E2E lifecycle flow
├─ QA-6: E2E cancellation flow
├─ QA-7: Permission tests
└─ QA-8: Update stats tests

Phase 5 — Documentation (depends on Phase 4)
├─ PM-1: Update CLAUDE.md
├─ PM-2: Update ARCHITECTURE.md
├─ DB-3: Update ER diagram
└─ PM-3: Final review
```

---

## 6. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing TFD data uses removed statuses | High | Migration (DB-2) maps old→new before deleting |
| Frontend breaks if enum changes before backend deploys | Medium | Deploy backend first; shared package builds atomically |
| WhatsApp notifications may need new status messages | Low | Currently only fires on submit (draft→pending); no change needed |
| `getStats()` field rename breaks dashboard | Medium | Update dashboard page to use `inTransit` field simultaneously with BE-4 |
| `statusId` → `statusCode` DTO change breaks existing API consumers | Medium | Announce breaking change; update API tests first |

---

## 7. Files Modified (Complete List)

### Shared Package
- `packages/shared/src/enums/tfd-status.enum.ts` — BE-1

### Backend (API)
- `apps/api/src/tfd/tfd.service.ts` — BE-2, BE-3, BE-4
- `apps/api/src/tfd/tfd.controller.ts` — BE-5
- `apps/api/src/tfd/dto/update-tfd-status.dto.ts` — BE-6
- `apps/api/src/database/seeds/seed.ts` — DB-1
- `apps/api/src/database/migrations/XXXXXX-SimplifyTfdStatuses.ts` — DB-2 (new file)

### Frontend (Web)
- `apps/web/src/app/(protected)/tfd/requests/page.tsx` — FE-1, FE-2
- `apps/web/src/app/(protected)/tfd/requests/[id]/page.tsx` — FE-1, FE-3, FE-5
- `apps/web/src/app/(protected)/tfd/requests/new/page.tsx` — FE-4

### Tests
- `apps/api/src/tfd/tfd.service.spec.ts` — QA-1, QA-2, QA-8
- `docs/tests/smoke-test.sh` — QA-3, QA-7
- `docs/tests/api.http` — QA-4
- `e2e/flows/tfd/tfd-lifecycle.yaml` — QA-5 (new file)
- `e2e/flows/tfd/tfd-cancel.yaml` — QA-6 (new file)

### Documentation
- `CLAUDE.md` — PM-1
- `docs/ARCHITECTURE.md` — PM-2
- `docs/database-er-diagram.mermaid` — DB-3

---

## 8. Acceptance Criteria (Overall)

1. The TFD module has exactly 5 statuses: `draft`, `pending`, `in_transit`, `finalized`, `cancelled`
2. The `PATCH /tfd/requests/:id/status` endpoint enforces valid transitions and returns 400 for invalid ones
3. Roles `admin_municipality` and `operator_tfd` can change TFD status; `viewer` cannot
4. The detail page shows context-aware action buttons based on current status
5. The detail page shows an "Editar" button for `draft` and `pending` statuses
6. Editing a `pending` request only allows travel, cost, and notes fields
7. Terminal statuses (`finalized`, `cancelled`) show no action buttons
8. All 14 transition test cases pass (6 valid + 8 invalid)
9. Smoke tests cover the full lifecycle end-to-end
10. E2E Maestro flows cover the happy path and cancellation path
11. Existing TFD data is migrated safely via the database migration
12. Documentation (CLAUDE.md, ARCHITECTURE.md, ER diagram) is updated
