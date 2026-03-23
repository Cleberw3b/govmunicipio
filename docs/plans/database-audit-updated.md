# Database & Data Structure Audit — Updated

**Original Date:** 2026-03-18
**Updated:** 2026-03-23
**Agent:** Database & Data Structure Specialist (Agent 6)
**Scope:** Full audit of all 22 entities, 9 junction tables, relationships, indexes, and query patterns
**Architectural Decisions Applied:**
1. No cascades ever — universal soft delete pattern (createdAt/updatedAt/deletedAt) on ALL entities
2. OTP tokens moved from database to Redis
3. Person and Organization support multiple Addresses via junction tables (not direct FK)

---

## 1. Relationship Correctness

### 1.1 CRITICAL — No Cascades Policy (UPDATED)

**Decision:** The project adopts a strict **no cascades** policy. No entity shall define `cascade: true` or `onDelete: 'CASCADE'` on any relationship. All delete operations are soft deletes (`deletedAt` timestamp), ensuring full data traceability and recoverability.

**Current state:** No entity defines cascades — this is correct and intentional.

**Action required:** Add explicit `onDelete: 'RESTRICT'` to all `@ManyToOne` relationships. This makes the intent clear and prevents accidental hard deletes at the database level.

| Parent | Child | FK Column | Action |
|--------|-------|-----------|--------|
| Person | PersonIdentification | person_id | Add `onDelete: 'RESTRICT'` |
| Person | Principal | person_id | Add `onDelete: 'RESTRICT'` |
| Person | Doctor | person_id | Add `onDelete: 'RESTRICT'` |
| Person | TfdRequest (patient) | patient_person_id | Add `onDelete: 'RESTRICT'` |
| Person | TfdRequest (companion) | companion_person_id | Add `onDelete: 'RESTRICT'` |
| Organization | Municipality | organization_id | Add `onDelete: 'RESTRICT'` |
| Organization | Hospital | organization_id | Add `onDelete: 'RESTRICT'` |
| Organization | Hotel | organization_id | Add `onDelete: 'RESTRICT'` |
| Organization | Principal | organization_id | Add `onDelete: 'RESTRICT'` |
| Municipality | TfdRequest | municipality_id | Add `onDelete: 'RESTRICT'` |
| Municipality | PickupAddress | municipality_id | Add `onDelete: 'RESTRICT'` |
| Status | TfdRequest | status_id | Add `onDelete: 'RESTRICT'` |
| Principal | TfdRequest | created_by_principal_id | Add `onDelete: 'RESTRICT'` |
| Principal | Notification | recipient_id | Add `onDelete: 'RESTRICT'` |

**Soft delete enforcement:** All services must use TypeORM's `softDelete()` / `softRemove()` methods. Hard deletes are forbidden in application code. The `@DeleteDateColumn` on BaseEntity automatically filters soft-deleted rows from queries via TypeORM's `withDeleted: false` default.

### 1.2 HIGH — OneToOne Relationships Without Unique Constraints on FK

The TypeORM `@OneToOne` + `@JoinColumn` pattern does not automatically create a UNIQUE constraint on the FK column unless explicitly configured. Without it, the database allows multiple rows pointing to the same parent — violating the OneToOne invariant.

**Affected:**

| Entity | FK Column | Required Action |
|--------|-----------|-----------------|
| PersonIdentification | person_id | Add `{ unique: true }` to `@JoinColumn` + migration |
| Municipality | organization_id | Add `{ unique: true }` to `@JoinColumn` + migration |
| Hospital | organization_id | Add `{ unique: true }` to `@JoinColumn` + migration |
| Hotel | organization_id | Add `{ unique: true }` to `@JoinColumn` + migration |
| Principal | person_id | Add `{ unique: true }` to `@JoinColumn` + migration |
| Principal | organization_id | Add `{ unique: true }` to `@JoinColumn` + migration |
| Doctor | person_id | Add `{ unique: true }` to `@JoinColumn` + migration |

### 1.3 MEDIUM — Bidirectional Relationship Gaps

Several OneToOne relationships are defined only on one side. Adding inverse sides simplifies queries where services navigate from the non-owner side.

| Relationship | Owner side | Inverse defined? | Used in queries? |
|-------------|-----------|-----------------|-----------------|
| Person ↔ PersonIdentification | PersonIdentification | Yes ✓ | — |
| Person ↔ Principal | Principal | No ✗ | Yes — needs inverse |
| Person ↔ Doctor | Doctor | No ✗ | Yes — needs inverse |
| Organization ↔ Municipality | Municipality | No ✗ | Yes — `getMunicipalityByOrganizationId` |
| Organization ↔ Hospital | Hospital | No ✗ | Yes — needs inverse |
| Organization ↔ Hotel | Hotel | No ✗ | No — optional |

**Recommendation:** Add inverse `@OneToOne` on Person (for principal, doctor) and Organization (for municipality, hospital) to enable relation loading from those sides.

### 1.4 CRITICAL — OTP Tokens Must Move to Redis (UPDATED)

**Decision:** `OtpTokenEntity` should NOT live in the database. OTP tokens are short-lived (15-minute TTL), high-churn records that are perfect candidates for Redis.

**Current state:** `OtpTokenEntity` extends BaseEntity and stores in PostgreSQL with compound index on `(principalId, expiresAt)`.

**Required changes:**

1. Remove `OtpTokenEntity` from the entities directory
2. Remove the `otp_token` table via migration (drop table)
3. Implement OTP storage in Redis using key pattern: `otp:{principalId}:{code}`
4. Use Redis TTL (900 seconds = 15 minutes) instead of `expiresAt` column
5. Use Redis `SET` with `NX` flag to prevent duplicates
6. Mark "used" by deleting the key (or setting a `used:` prefix key)
7. Update `AuthService` to use Redis client instead of TypeORM repository

**Redis key structure:**
```
otp:{principalId}         → { code: "123456", createdAt: "..." }  TTL: 900s
otp:used:{principalId}    → "1"                                    TTL: 900s (prevent reuse)
```

**Benefits:** No table bloat, automatic expiration via TTL, no cleanup jobs needed, faster reads.

### 1.5 MEDIUM — AuditLog Uses Raw Columns (Intentional)

`AuditLogEntity` stores `actorId` and `entityId` as raw UUID columns. This is correct — audit logs must survive entity deletion (soft or otherwise). The raw columns ensure referential integrity doesn't block soft deletes.

**Action:** Add index on `actorId` (frequent filter in admin audit viewer).

### 1.6 CRITICAL — Junction Tables Must Follow Soft Delete Pattern (UPDATED)

**Decision:** ALL entities, including junction/link tables, must have `createdAt`, `updatedAt`, and `deletedAt` columns. No exceptions.

**Current state — entities NOT following the pattern:**

| Entity | Extends BaseEntity? | Has timestamps? | Action |
|--------|-------------------|----------------|--------|
| MunicipalityHospitalLinkEntity | No ✗ | No ✗ | Must extend BaseEntity or add columns |
| MunicipalityHotelLinkEntity | No ✗ | No ✗ | Must extend BaseEntity or add columns |

**TypeORM ManyToMany auto-generated junction tables (no entity file):**

These tables are created automatically by TypeORM via `@ManyToMany` + `@JoinTable` and have NO extra columns. They need to be converted to explicit entities with BaseEntity fields:

| Junction Table | Owner Entity | Related Entity | Action |
|---------------|-------------|---------------|--------|
| person_contact | Person | Contact | Convert to explicit entity |
| organization_contact | Organization | Contact | Convert to explicit entity |
| principal_role | Principal | Role | Convert to explicit entity |
| principal_organization | Principal | Organization | Convert to explicit entity |
| role_permission | Role | Permission | Convert to explicit entity |
| hospital_specialty | Hospital | Specialty | Convert to explicit entity |
| doctor_specialty | Doctor | Specialty | Convert to explicit entity |

**Implementation approach:** For each auto-generated junction table:
1. Create an explicit entity class extending BaseEntity (but using composite PK, not UUID)
2. Replace `@ManyToMany` + `@JoinTable` on the owner entity with `@OneToMany` to the new link entity
3. The link entity gets two `@ManyToOne` relationships
4. Create migration to add `id`, `created_at`, `updated_at`, `deleted_at` columns to existing tables

**Alternative approach (simpler):** Keep the composite PK pattern but add timestamp columns without extending BaseEntity:

```typescript
@Entity('municipality_hospital')
export class MunicipalityHospitalLinkEntity {
  @PrimaryColumn({ name: 'municipality_id' })
  municipalityId!: string;

  @PrimaryColumn({ name: 'hospital_id' })
  hospitalId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
```

**Recommended approach:** Use the alternative (simpler) pattern for junction tables — composite PK + timestamp columns, no surrogate UUID. This avoids breaking existing queries and keeps junction tables lean.

---

## 2. Data Integrity Issues

### 2.1 CRITICAL — Person and Organization Address Relationship (UPDATED)

**Decision:** Person and Organization can have **multiple** Addresses. The relationship must use junction/link tables, not direct FK. Addresses are NOT shared between entities — each Person/Organization owns their own address records. The same physical address can be duplicated (different rows with same data), but each row belongs to exactly one owner.

**Current state:**
- `PersonEntity` has `@ManyToOne(() => AddressEntity)` with `address_id` FK — allows only ONE address
- `OrganizationEntity` has `@ManyToOne(() => AddressEntity)` with `address_id` FK — allows only ONE address
- There is no way to know which Person or Organization owns an address

**Required changes:**

1. **Remove direct FK** from Person and Organization:
   - Drop `address_id` column from `person` table
   - Drop `address_id` column from `organization` table

2. **Create `person_address` link table:**

```typescript
@Entity('person_address')
export class PersonAddressLinkEntity {
  @PrimaryColumn({ name: 'person_id' })
  personId!: string;

  @PrimaryColumn({ name: 'address_id' })
  addressId!: string;

  @ManyToOne(() => PersonEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'person_id' })
  person!: PersonEntity;

  @ManyToOne(() => AddressEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'address_id' })
  address!: AddressEntity;

  @Column({ type: 'varchar', nullable: true })
  label!: string | null;  // "residential", "work", "billing", etc.

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
```

3. **Create `organization_address` link table:**

```typescript
@Entity('organization_address')
export class OrganizationAddressLinkEntity {
  @PrimaryColumn({ name: 'organization_id' })
  organizationId!: string;

  @PrimaryColumn({ name: 'address_id' })
  addressId!: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization!: OrganizationEntity;

  @ManyToOne(() => AddressEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'address_id' })
  address!: AddressEntity;

  @Column({ type: 'varchar', nullable: true })
  label!: string | null;  // "headquarters", "branch", "billing", etc.

  @Column({ type: 'boolean', default: false, name: 'is_primary' })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
```

4. **Update Person entity:**

```typescript
// REMOVE:
@ManyToOne(() => AddressEntity, { nullable: true, eager: false })
@JoinColumn({ name: 'address_id' })
address!: AddressEntity | null;

// ADD:
@OneToMany(() => PersonAddressLinkEntity, (link) => link.person)
addressLinks!: PersonAddressLinkEntity[];
```

5. **Update Organization entity:**

```typescript
// REMOVE:
@ManyToOne(() => AddressEntity, { nullable: true })
@JoinColumn({ name: 'address_id' })
address!: AddressEntity | null;

// ADD:
@OneToMany(() => OrganizationAddressLinkEntity, (link) => link.organization)
addressLinks!: OrganizationAddressLinkEntity[];
```

6. **Data migration:** For each existing `person.address_id` and `organization.address_id`, create a corresponding row in the new link table with `is_primary: true`, then drop the FK columns.

**Ownership rule:** Each address row belongs to exactly one entity via its link table. When a Person is soft-deleted, their address links are also soft-deleted. The address row itself remains (for audit purposes) but is effectively orphaned. A cleanup job can hard-delete truly orphaned addresses periodically if needed.

### 2.2 MEDIUM — Contact Relationship Already Uses Junction Tables (CONFIRMED)

**Current state:** Both Person and Organization already use `@ManyToMany` junction tables for contacts:
- `person_contact` (person_id, contact_id)
- `organization_contact` (organization_id, contact_id)

This is correct. However, per Section 1.6, these auto-generated junction tables need to be converted to explicit entities with timestamp columns.

**Additional concern:** The same `ContactEntity` could be referenced by both a Person and an Organization (or by multiple Persons). Per the user's decision, contacts should NOT be shared — each entity owns its own contact records.

**Action:** Add a unique constraint on `contact_id` in each junction table to enforce one-owner-per-contact:
```sql
ALTER TABLE person_contact ADD CONSTRAINT uq_person_contact_contact UNIQUE (contact_id);
ALTER TABLE organization_contact ADD CONSTRAINT uq_org_contact_contact UNIQUE (contact_id);
```

This ensures a contact row can only appear in ONE junction table and only once, establishing clear ownership.

### 2.3 MEDIUM — ModuleStatus Missing Composite Unique

`ModuleStatusEntity` links a Module to a Status with a sort_order. There is no unique constraint preventing the same module-status pair from being inserted twice.

**Action:** Add `@Unique(['module', 'status'])` to the entity and create migration.

### 2.4 LOW — Decimal Precision Consistency

All monetary fields correctly use `decimal(10,2)`. The `price` field on `SpecialtyEntity` also uses this precision. This is correct and consistent. No action needed.

---

## 3. Missing Indexes

### 3.1 Currently Defined Indexes

| Entity | Index | Type |
|--------|-------|------|
| OtpToken | (principal_id, expires_at) | Compound @Index — TO BE REMOVED (moving to Redis) |
| TfdRequest | (municipality_id, status_id) | Compound — from migration |
| TfdRequest | (created_by_principal_id) | Single — from migration |
| TfdRequest | (protocol_number) | Single — unique constraint |

### 3.2 Missing Indexes (from query analysis)

**HIGH PRIORITY — Frequent query filters without explicit indexes:**

| Table | Column(s) | Query Pattern | Urgency |
|-------|----------|---------------|---------|
| tfd_request | (municipality_id, created_at) | Stats aggregation — monthly counts and spending | HIGH |
| notification | (recipient_id, is_read) | Unread count — called on every page load | HIGH |
| status | code | TFD status filtering — every list query joins on status.code | HIGH |
| person_address | (person_id) | Address lookup when loading person | HIGH (new table) |
| organization_address | (organization_id) | Address lookup when loading org | HIGH (new table) |
| specialty | is_active | Specialty list filtering | LOW |
| audit_log | actor_id | Admin audit viewer filtering | LOW |
| audit_log | entity_type | Admin audit viewer filtering | LOW |
| audit_log | created_at | Admin audit viewer date range | LOW |

### 3.3 FK Auto-Index Verification

TypeORM creates indexes on `@ManyToOne` FKs automatically. Verify these exist for high-traffic queries:

| Table | FK Column | Importance |
|-------|-----------|------------|
| tfd_request | municipality_id | CRITICAL |
| tfd_request | status_id | HIGH |
| tfd_request | patient_person_id | MEDIUM |
| notification | recipient_id | HIGH |
| pickup_address | municipality_id | MEDIUM |

---

## 4. N+1 Query Problems

### 4.1 CRITICAL — Auth Login Path

`AuthService.validatePrincipal()` loads `relations: ['roles', 'roles.permissions', 'organizations']` on every login attempt. Roles and permissions are static — prime candidate for Redis caching.

### 4.2 HIGH — List Endpoints Loading Full Relation Trees

| Endpoint | Relations Loaded | Impact |
|----------|-----------------|--------|
| GET /admin/users | roles, organizations, person.identification | ALL users |
| GET /admin/doctors | person, specialties | ALL doctors |
| GET /hospitals | organization, address*, contacts, specialties | ALL hospitals |
| GET /tfd/requests | patient, identification, companion, doctor, hospital, hotel, status | ALL requests |

*Note: `address` loading will change from direct join to junction table join after the Address migration.

**Recommendation:** Use `select` on QueryBuilder to fetch only columns needed for list views. Load full relations only on detail endpoints.

### 4.3 MEDIUM — Municipality Service Two-Phase Queries

`findLinkedHospitals()` and `findLinkedHotels()` perform two queries: find link IDs, then load entities. Should be a single JOIN query.

### 4.4 MEDIUM — Doctor Search Three Separate Queries

`OrganizationService.searchDoctors()` runs three separate `findOne` queries (by CRM, firstName, lastName). Should be a single query with `OR` conditions.

---

## 5. Schema Design Observations

### 5.1 Organization Subtype Pattern

Organization as base type with Hospital, Hotel, Municipality as subtypes via OneToOne is valid "table-per-type" inheritance. No discriminator column needed since the subtype tables themselves serve as discriminators.

### 5.2 Principal vs Person Separation

Good pattern. Allows people (patients, companions) to exist without accounts, and accounts to exist without full person records.

### 5.3 Status System — ModuleStatus Redundancy

`ModuleStatus` links Module to Status with sort_order. However, TfdRequest references Status directly (not ModuleStatus), so the module-specific ordering is unused in practice. Consider whether ModuleStatus is needed or if Status alone suffices for the TFD module.

---

## 6. Summary of Entity Compliance

### Soft Delete / Timestamp Compliance Matrix

| Entity | Extends BaseEntity | Has createdAt | Has updatedAt | Has deletedAt | Compliant? |
|--------|-------------------|---------------|---------------|---------------|------------|
| PersonEntity | Yes | Yes | Yes | Yes | ✓ |
| PersonIdentificationEntity | Yes | Yes | Yes | Yes | ✓ |
| AddressEntity | Yes | Yes | Yes | Yes | ✓ |
| ContactEntity | Yes | Yes | Yes | Yes | ✓ |
| OrganizationEntity | Yes | Yes | Yes | Yes | ✓ |
| MunicipalityEntity | Yes | Yes | Yes | Yes | ✓ |
| HospitalEntity | Yes | Yes | Yes | Yes | ✓ |
| HotelEntity | Yes | Yes | Yes | Yes | ✓ |
| PrincipalEntity | Yes | Yes | Yes | Yes | ✓ |
| DoctorEntity | Yes | Yes | Yes | Yes | ✓ |
| SpecialtyEntity | Yes | Yes | Yes | Yes | ✓ |
| RoleEntity | Yes | Yes | Yes | Yes | ✓ |
| PermissionEntity | Yes | Yes | Yes | Yes | ✓ |
| StatusEntity | Yes | Yes | Yes | Yes | ✓ |
| ModuleEntity | Yes | Yes | Yes | Yes | ✓ |
| ModuleStatusEntity | Yes | Yes | Yes | Yes | ✓ |
| TfdRequestEntity | Yes | Yes | Yes | Yes | ✓ |
| NotificationEntity | Yes | Yes | Yes | Yes | ✓ |
| PickupAddressEntity | Yes | Yes | Yes | Yes | ✓ |
| AuditLogEntity | Yes | Yes | Yes | Yes | ✓ |
| OtpTokenEntity | Yes | Yes | Yes | Yes | TO BE REMOVED (Redis) |
| MunicipalityHospitalLinkEntity | **No** | **No** | **No** | **No** | ✗ NEEDS FIX |
| MunicipalityHotelLinkEntity | **No** | **No** | **No** | **No** | ✗ NEEDS FIX |

**Auto-generated junction tables (no entity file — need explicit entities):**

| Table | Has timestamps? | Compliant? |
|-------|----------------|------------|
| person_contact | No | ✗ NEEDS FIX |
| organization_contact | No | ✗ NEEDS FIX |
| principal_role | No | ✗ NEEDS FIX |
| principal_organization | No | ✗ NEEDS FIX |
| role_permission | No | ✗ NEEDS FIX |
| hospital_specialty | No | ✗ NEEDS FIX |
| doctor_specialty | No | ✗ NEEDS FIX |

---

## 7. Recommended Actions (Prioritized)

### Priority 1 — Architecture Changes (must do before next feature)

| # | Task | Section | Effort |
|---|------|---------|--------|
| 1 | Move OTP tokens to Redis — remove OtpTokenEntity, drop table, implement Redis service | 1.4 | HIGH |
| 2 | Create person_address and organization_address link tables — remove direct FK from Person/Organization, migrate existing data | 2.1 | HIGH |
| 3 | Add timestamps (created_at, updated_at, deleted_at) to MunicipalityHospitalLinkEntity and MunicipalityHotelLinkEntity | 1.6 | LOW |
| 4 | Convert all 7 auto-generated junction tables to explicit entities with timestamps | 1.6 | MEDIUM |

### Priority 2 — Data Safety (before production load)

| # | Task | Section | Effort |
|---|------|---------|--------|
| 5 | Add `onDelete: 'RESTRICT'` to all @ManyToOne relationships (14 affected) | 1.1 | MEDIUM |
| 6 | Add UNIQUE constraints on all OneToOne FK columns (7 affected) | 1.2 | LOW |
| 7 | Add composite unique on ModuleStatus (module_id, status_id) | 2.3 | LOW |
| 8 | Add unique constraint on contact_id in person_contact and organization_contact | 2.2 | LOW |

### Priority 3 — Performance (before scaling)

| # | Task | Section | Effort |
|---|------|---------|--------|
| 9 | Create migration adding HIGH-priority indexes from section 3.2 | 3.2 | LOW |
| 10 | Cache roles+permissions in Redis for auth login path | 4.1 | MEDIUM |
| 11 | Merge municipality two-phase queries into single JOINs | 4.3 | LOW |
| 12 | Fix doctor search — single query with OR conditions | 4.4 | LOW |
| 13 | Add select() to list queries — don't load full relation trees | 4.2 | MEDIUM |

### Priority 4 — Code Quality (incremental)

| # | Task | Section | Effort |
|---|------|---------|--------|
| 14 | Add inverse sides to OneToOne relationships (Person, Organization) | 1.3 | LOW |
| 15 | Add explicit @Index() decorators for documentation purposes | 3.3 | LOW |
| 16 | Update ER diagram to reflect all changes | — | MEDIUM |
| 17 | Update ARCHITECTURE.md with soft-delete and no-cascade policies | — | LOW |

---

## 8. New Entity Files Required

After implementing all changes, these new entity files will be needed:

```
apps/api/src/entities/person-address-link.entity.ts      (NEW)
apps/api/src/entities/organization-address-link.entity.ts (NEW)
apps/api/src/entities/person-contact-link.entity.ts       (NEW - replaces auto-generated)
apps/api/src/entities/organization-contact-link.entity.ts (NEW - replaces auto-generated)
apps/api/src/entities/principal-role-link.entity.ts       (NEW - replaces auto-generated)
apps/api/src/entities/principal-organization-link.entity.ts (NEW - replaces auto-generated)
apps/api/src/entities/role-permission-link.entity.ts      (NEW - replaces auto-generated)
apps/api/src/entities/hospital-specialty-link.entity.ts   (NEW - replaces auto-generated)
apps/api/src/entities/doctor-specialty-link.entity.ts     (NEW - replaces auto-generated)
```

**Files to remove:**
```
apps/api/src/entities/otp-token.entity.ts                 (REMOVE - Redis)
```

**Files to modify:**
```
apps/api/src/entities/person.entity.ts                    (remove address FK, add addressLinks)
apps/api/src/entities/organization.entity.ts              (remove address FK, add addressLinks)
apps/api/src/entities/municipality-hospital-link.entity.ts (add timestamps)
apps/api/src/entities/municipality-hotel-link.entity.ts   (add timestamps)
apps/api/src/auth/auth.service.ts                         (Redis OTP)
```
