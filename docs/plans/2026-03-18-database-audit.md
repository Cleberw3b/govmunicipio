# Database & Data Structure Audit

**Date:** 2026-03-18
**Agent:** Database & Data Structure Specialist (Agent 6)
**Scope:** Full audit of all 22 entities, 9 junction tables, relationships, indexes, and query patterns

---

## 1. Relationship Correctness

### 1.1 CRITICAL — Missing Cascade Rules

No entity in the codebase defines `cascade` or `onDelete` options on any relationship. This means:

- **Deleting a Person** that is referenced by a Principal, Doctor, or TfdRequest will throw a foreign key violation at the database level (500 error) instead of a clean application error.
- **Deleting an Organization** that is referenced by Municipality, Hospital, Hotel, or Principal will crash.
- **Deleting a Status** that is referenced by TfdRequest will crash.

**Affected relationships (no cascade/onDelete defined):**

| Parent | Child | FK Column | Risk |
|--------|-------|-----------|------|
| Person | PersonIdentification | person_id | Orphaned identification if person deleted |
| Person | Principal | person_id | FK violation |
| Person | Doctor | person_id | FK violation |
| Person | TfdRequest | patient_person_id | FK violation |
| Organization | Municipality | organization_id | FK violation |
| Organization | Hospital | organization_id | FK violation |
| Organization | Hotel | organization_id | FK violation |
| Organization | Principal | organization_id | FK violation |
| Municipality | TfdRequest | municipality_id | FK violation |
| Municipality | PickupAddress | municipality_id | FK violation |
| Status | TfdRequest | status_id | FK violation |
| Principal | TfdRequest | created_by_principal_id | FK violation |

**Recommendation:** Add `onDelete: 'RESTRICT'` explicitly to all `@ManyToOne` relationships on critical tables (TfdRequest, Principal). This makes the behavior intentional rather than accidental. For the PersonIdentification → Person relationship, add `cascade: true` on the Person side and `onDelete: 'CASCADE'` on PersonIdentification so deleting a person cleans up their identification.

### 1.2 HIGH — OneToOne Relationships Without Unique Constraints on FK

The TypeORM `@OneToOne` + `@JoinColumn` pattern does not automatically create a UNIQUE constraint on the FK column unless explicitly configured. Without it, the database allows multiple rows pointing to the same parent — violating the OneToOne invariant.

**Affected:**

| Entity | FK Column | Has DB-level UNIQUE? |
|--------|-----------|---------------------|
| PersonIdentification | person_id | Unknown — depends on migration |
| Municipality | organization_id | Unknown |
| Hospital | organization_id | Unknown |
| Hotel | organization_id | Unknown |
| Principal | person_id | Unknown |
| Principal | organization_id | Unknown |
| Doctor | person_id | Unknown |

**Recommendation:** Verify these FK columns have UNIQUE constraints in the database. If not, create a migration adding `UNIQUE` to each. In the entity, add `{ unique: true }` to the `@JoinColumn`.

### 1.3 MEDIUM — Bidirectional Relationship Gaps

Several OneToOne relationships are defined only on one side, which means navigating from the other side requires a separate query:

| Relationship | Owner side | Inverse side defined? |
|-------------|-----------|----------------------|
| Person ↔ PersonIdentification | PersonIdentification has @JoinColumn | Person has inverse ✓ |
| Person ↔ Principal | Principal has @JoinColumn | Person has NO inverse ✗ |
| Person ↔ Doctor | Doctor has @JoinColumn | Person has NO inverse ✗ |
| Organization ↔ Municipality | Municipality has @JoinColumn | Organization has NO inverse ✗ |
| Organization ↔ Hospital | Hospital has @JoinColumn | Organization has NO inverse ✗ |
| Organization ↔ Hotel | Hotel has @JoinColumn | Organization has NO inverse ✗ |

This is not a bug — it just means you cannot do `organization.municipality` from TypeORM (you need a separate query). However, if query patterns require it (and they do — `getMunicipalityByOrganizationId` exists in two services), adding inverse sides would simplify queries.

### 1.4 MEDIUM — OtpToken Uses Raw Column Instead of Relation

`OtpTokenEntity` stores `principalId` as a raw `@Column` (plain string) instead of a `@ManyToOne` relationship to `PrincipalEntity`. This means:

- No foreign key constraint at DB level — orphaned OTP tokens possible
- No cascaded deletes when a principal is removed
- No TypeORM relation loading (`relations: ['principal']`)

**Recommendation:** Change to `@ManyToOne(() => PrincipalEntity)` + `@JoinColumn({ name: 'principal_id' })` and add a proper FK constraint.

### 1.5 MEDIUM — AuditLog Uses Raw Columns Instead of Relations

`AuditLogEntity` stores `actorId` and `entityId` as raw UUID columns. This is intentional (audit logs should survive entity deletion), but `actorId` should at least have an index since it's a frequent filter.

### 1.6 LOW — Junction Tables Without Soft Delete

`MunicipalityHospitalLinkEntity` and `MunicipalityHotelLinkEntity` do NOT extend BaseEntity, so they lack `deleted_at`. When a link is removed, it's a hard delete with no recovery. This is acceptable for junction tables but worth documenting as intentional.

---

## 2. Missing Indexes

### 2.1 Currently Defined Indexes

| Entity | Index | Type |
|--------|-------|------|
| OtpToken | (principal_id, expires_at) | Compound @Index |
| TfdRequest | (municipality_id, status_id) | Compound — from migration |
| TfdRequest | (created_by_principal_id) | Single — from migration |
| OtpToken | (principal_id, expires_at) | Compound — from migration |
| TfdRequest | (protocol_number) | Single — from migration |

**Note:** TypeORM auto-creates indexes on `@ManyToOne` FK columns. Unique column constraints also create implicit indexes.

### 2.2 Missing Indexes (from query analysis)

**HIGH PRIORITY — Frequent query filters without explicit indexes:**

| Table | Column(s) | Query Pattern | Urgency |
|-------|----------|---------------|---------|
| tfd_request | (municipality_id, created_at) | Stats aggregation — monthly counts and spending | HIGH |
| notification | (recipient_id, is_read) | Unread count — called on every page load | HIGH |
| status | code | TFD status filtering — every list query joins on status.code | HIGH |
| otp_token | (principal_id, code) | OTP verification lookup | MEDIUM |
| otp_token | (principal_id, used_at) | Invalidating previous OTP codes | MEDIUM |
| specialty | is_active | Specialty list filtering | LOW |
| audit_log | actor_id | Admin audit viewer filtering | LOW |
| audit_log | entity_type | Admin audit viewer filtering | LOW |
| audit_log | created_at | Admin audit viewer date range | LOW |

### 2.3 Indexes on Auto-Generated FKs (Verify)

TypeORM claims to create indexes on `@ManyToOne` FKs, but this should be verified. The following FKs handle high-traffic queries:

| Table | FK Column | Importance |
|-------|-----------|------------|
| tfd_request | municipality_id | CRITICAL — every list query |
| tfd_request | status_id | HIGH — every filtered list |
| tfd_request | patient_person_id | MEDIUM — patient lookup |
| notification | recipient_id | HIGH — every page load |
| pickup_address | municipality_id | MEDIUM — address list |
| module_status | module_id | LOW |
| module_status | status_id | LOW |

---

## 3. Data Integrity Issues

### 3.1 HIGH — No Uniqueness on OneToOne FKs

As noted in 1.2, the OneToOne relationships on `hospital.organization_id`, `municipality.organization_id`, `hotel.organization_id`, `doctor.person_id`, and `principal.person_id` should have UNIQUE constraints at the database level to prevent data corruption.

### 3.2 MEDIUM — Contact/Address Sharing Without Referential Integrity

`ContactEntity` and `AddressEntity` are shared via junction tables (`person_contact`, `organization_contact`) and direct FK (`person.address_id`, `organization.address_id`). However:

- A contact or address can be orphaned if the owning person/organization is deleted (no cascade)
- The same address could be referenced by both a Person and an Organization — is this intentional?
- There's no way to know which entity "owns" an address record

**Recommendation:** Consider adding an `owner_type` + `owner_id` polymorphic pattern, or simply accept that addresses/contacts are shared value objects and add cleanup logic.

### 3.3 MEDIUM — ModuleStatus Missing Composite Unique

`ModuleStatusEntity` links a Module to a Status with a sort_order. There's no unique constraint preventing the same module-status pair from being inserted twice. Add `@Unique(['module', 'status'])`.

### 3.4 LOW — Decimal Precision Consistency

All monetary fields correctly use `decimal(10,2)`. The `price` field on `SpecialtyEntity` also uses this precision. This is correct and consistent.

---

## 4. N+1 Query Problems

### 4.1 CRITICAL — Auth Login Path

`AuthService.validatePrincipal()` loads `relations: ['roles', 'roles.permissions', 'organizations']` on every login attempt. Since roles and permissions are relatively static, this is a prime candidate for caching.

### 4.2 HIGH — List Endpoints Loading Full Relation Trees

Several list endpoints load deep relation trees for every row:

| Endpoint | Entity | Relations Loaded | Rows |
|----------|--------|-----------------|------|
| GET /admin/users | Principal | roles, organizations, person.identification | ALL users |
| GET /admin/doctors | Doctor | person, specialties | ALL doctors |
| GET /hospitals | Hospital | organization, address, contacts, specialties | ALL hospitals |
| GET /tfd/requests | TfdRequest | patient, identification, companion, doctor, hospital, hotel, status | ALL requests |

As data grows, these will become slow. Pagination (already added) helps, but the deep joins are still expensive.

**Recommendation:** Use `select` on QueryBuilder to fetch only the columns needed for list views. Load full relations only on detail endpoints.

### 4.3 MEDIUM — Municipality Service Two-Phase Queries

`findLinkedHospitals()` and `findLinkedHotels()` perform two queries: first find link IDs, then load entities by those IDs. This could be a single JOIN query.

### 4.4 MEDIUM — Doctor Search Three Separate Queries

`OrganizationService.searchDoctors()` runs three separate `findOne` queries (by CRM, by firstName, by lastName) then merges results. This should be a single query with `OR` conditions.

---

## 5. Schema Design Observations

### 5.1 Organization Subtype Pattern

The project uses Organization as a base type with Hospital, Hotel, and Municipality as subtypes via OneToOne. This is a valid "table-per-type" inheritance pattern. However, the lack of a discriminator column on Organization means there's no way to query "all hospitals" without joining the hospital table.

### 5.2 Principal vs Person Separation

The separation between `Principal` (auth/account) and `Person` (identity/demographics) is a good pattern. It allows people (patients, companions) to exist without accounts, and accounts to exist without full person records (e.g., system accounts).

### 5.3 Status System Flexibility

The `Module + Status + ModuleStatus` pattern provides flexible status management per module. However, TfdRequest references Status directly (not ModuleStatus), which means the module-specific ordering is unused. Consider whether ModuleStatus is actually needed or if Status alone suffices.

---

## 6. Recommended Actions

### Priority 1 — Data Safety (should fix before production load)

1. **Add `onDelete: 'RESTRICT'`** to all `@ManyToOne` on TfdRequest, Principal, Notification (prevents orphaning critical data)
2. **Add UNIQUE constraints** on all OneToOne FK columns via migration
3. **Convert OtpToken.principalId** from raw column to proper `@ManyToOne` relation
4. **Add composite unique** on ModuleStatus (module_id, status_id)

### Priority 2 — Performance (should fix before scaling)

5. **Create migration** adding indexes from section 2.2 (HIGH priority items)
6. **Optimize auth query** — cache roles+permissions or use a materialized view
7. **Merge municipality two-phase queries** into single JOINs
8. **Fix deprecated `findByIds()`** in OrganizationService
9. **Add select() to list queries** — don't load full relation trees for list views

### Priority 3 — Code Quality (can fix incrementally)

10. **Add inverse sides** to OneToOne relationships where services query from the non-owner side
11. **Add `onDelete: 'CASCADE'`** on PersonIdentification → Person
12. **Document the soft-delete exception** for junction tables in ARCHITECTURE.md
13. **Add explicit `@Index()`** decorators to entity files for all indexes (even FK auto-indexes) for documentation purposes
