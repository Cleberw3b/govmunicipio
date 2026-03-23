import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fresh initial schema for GovMunicípio.
 * Replaces all previous migrations.
 *
 * Design rules:
 * - All tables have created_at, updated_at, deleted_at (universal soft delete)
 * - All FKs use ON DELETE RESTRICT (no cascades ever)
 * - All many-to-many use explicit junction tables with timestamps
 * - OTP tokens live in Redis, not in the database
 */
export class InitialSchema1742900000000 implements MigrationInterface {
  name = 'InitialSchema1742900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Extensions ──────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ─── Core identity tables ────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "address" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "street" character varying NOT NULL,
        "number" character varying NOT NULL,
        "complement" character varying,
        "neighborhood" character varying NOT NULL,
        "city" character varying NOT NULL,
        "state" character varying(2) NOT NULL,
        "zip_code" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_address" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "contact" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying NOT NULL,
        "value" character varying NOT NULL,
        "label" character varying,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_contact" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "person" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "first_name" character varying NOT NULL,
        "last_name" character varying NOT NULL,
        "gender" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_person" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "person_identification" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cpf" character varying NOT NULL,
        "rg" character varying,
        "sus_card_number" character varying,
        "date_of_birth" date NOT NULL,
        "issuing_authority" character varying,
        "person_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_person_identification" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_person_identification_cpf" UNIQUE ("cpf"),
        CONSTRAINT "UQ_person_identification_sus" UNIQUE ("sus_card_number"),
        CONSTRAINT "UQ_person_identification_person" UNIQUE ("person_id"),
        CONSTRAINT "FK_person_identification_person" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT
      )
    `);

    // ─── Auth & RBAC ─────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "permission" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "resource" character varying NOT NULL,
        "action" character varying NOT NULL,
        "description" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_permission" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_permission_resource_action" UNIQUE ("resource", "action")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "description" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_role" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_role_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "role_permission" (
        "role_id" uuid NOT NULL,
        "permission_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_role_permission" PRIMARY KEY ("role_id", "permission_id"),
        CONSTRAINT "FK_role_permission_role" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_role_permission_permission" FOREIGN KEY ("permission_id") REFERENCES "permission"("id") ON DELETE RESTRICT
      )
    `);

    // ─── Organization hierarchy ──────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "organization" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "cnpj" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_organization" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organization_cnpj" UNIQUE ("cnpj")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "principal" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "email" character varying,
        "phone" character varying,
        "last_login" TIMESTAMP,
        "person_id" uuid,
        "organization_id" uuid,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_principal" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_principal_username" UNIQUE ("username"),
        CONSTRAINT "FK_principal_person" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_principal_organization" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "principal_role" (
        "principal_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_principal_role" PRIMARY KEY ("principal_id", "role_id"),
        CONSTRAINT "FK_principal_role_principal" FOREIGN KEY ("principal_id") REFERENCES "principal"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_principal_role_role" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "principal_organization" (
        "principal_id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_principal_organization" PRIMARY KEY ("principal_id", "organization_id"),
        CONSTRAINT "FK_principal_organization_principal" FOREIGN KEY ("principal_id") REFERENCES "principal"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_principal_organization_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT
      )
    `);

    // ─── Organization subtypes ───────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "municipality" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ibge_code" character varying NOT NULL,
        "state" character varying(2) NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_municipality" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_municipality_ibge" UNIQUE ("ibge_code"),
        CONSTRAINT "UQ_municipality_org" UNIQUE ("organization_id"),
        CONSTRAINT "FK_municipality_organization" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "hospital" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cnes_code" character varying NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_hospital" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hospital_cnes" UNIQUE ("cnes_code"),
        CONSTRAINT "UQ_hospital_org" UNIQUE ("organization_id"),
        CONSTRAINT "FK_hospital_organization" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "hotel" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_hotel" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_hotel_org" UNIQUE ("organization_id"),
        CONSTRAINT "FK_hotel_organization" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT
      )
    `);

    // ─── Address & Contact link tables ───────────────────────────

    await queryRunner.query(`
      CREATE TABLE "person_address" (
        "person_id" uuid NOT NULL,
        "address_id" uuid NOT NULL,
        "label" character varying,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_person_address" PRIMARY KEY ("person_id", "address_id"),
        CONSTRAINT "FK_person_address_person" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_person_address_address" FOREIGN KEY ("address_id") REFERENCES "address"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_address" (
        "organization_id" uuid NOT NULL,
        "address_id" uuid NOT NULL,
        "label" character varying,
        "is_primary" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_organization_address" PRIMARY KEY ("organization_id", "address_id"),
        CONSTRAINT "FK_organization_address_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_organization_address_addr" FOREIGN KEY ("address_id") REFERENCES "address"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "person_contact" (
        "person_id" uuid NOT NULL,
        "contact_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_person_contact" PRIMARY KEY ("person_id", "contact_id"),
        CONSTRAINT "UQ_person_contact_contact" UNIQUE ("contact_id"),
        CONSTRAINT "FK_person_contact_person" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_person_contact_contact" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "organization_contact" (
        "organization_id" uuid NOT NULL,
        "contact_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_organization_contact" PRIMARY KEY ("organization_id", "contact_id"),
        CONSTRAINT "UQ_organization_contact_contact" UNIQUE ("contact_id"),
        CONSTRAINT "FK_organization_contact_org" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_organization_contact_contact" FOREIGN KEY ("contact_id") REFERENCES "contact"("id") ON DELETE RESTRICT
      )
    `);

    // ─── Medical ─────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "specialty" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "group_code" character varying,
        "group_name" character varying,
        "price" decimal(10,2) NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_specialty" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_specialty_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "doctor" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "crm" character varying NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "person_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_doctor" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_doctor_crm" UNIQUE ("crm"),
        CONSTRAINT "UQ_doctor_person" UNIQUE ("person_id"),
        CONSTRAINT "FK_doctor_person" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "hospital_specialty" (
        "hospital_id" uuid NOT NULL,
        "specialty_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_hospital_specialty" PRIMARY KEY ("hospital_id", "specialty_id"),
        CONSTRAINT "FK_hospital_specialty_hospital" FOREIGN KEY ("hospital_id") REFERENCES "hospital"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_hospital_specialty_specialty" FOREIGN KEY ("specialty_id") REFERENCES "specialty"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "doctor_specialty" (
        "doctor_id" uuid NOT NULL,
        "specialty_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_doctor_specialty" PRIMARY KEY ("doctor_id", "specialty_id"),
        CONSTRAINT "FK_doctor_specialty_doctor" FOREIGN KEY ("doctor_id") REFERENCES "doctor"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_doctor_specialty_specialty" FOREIGN KEY ("specialty_id") REFERENCES "specialty"("id") ON DELETE RESTRICT
      )
    `);

    // ─── Municipality links ──────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "municipality_hospital" (
        "municipality_id" uuid NOT NULL,
        "hospital_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_municipality_hospital" PRIMARY KEY ("municipality_id", "hospital_id"),
        CONSTRAINT "FK_municipality_hospital_mun" FOREIGN KEY ("municipality_id") REFERENCES "municipality"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_municipality_hospital_hosp" FOREIGN KEY ("hospital_id") REFERENCES "hospital"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "municipality_hotel" (
        "municipality_id" uuid NOT NULL,
        "hotel_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_municipality_hotel" PRIMARY KEY ("municipality_id", "hotel_id"),
        CONSTRAINT "FK_municipality_hotel_mun" FOREIGN KEY ("municipality_id") REFERENCES "municipality"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_municipality_hotel_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotel"("id") ON DELETE RESTRICT
      )
    `);

    // ─── Status system ───────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "status" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying NOT NULL,
        "label" character varying NOT NULL,
        "sort_order" integer NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_status" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_status_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "module" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code" character varying NOT NULL,
        "name" character varying NOT NULL,
        "description" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_module" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_module_code" UNIQUE ("code")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "module_status" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sort_order" integer NOT NULL,
        "module_id" uuid NOT NULL,
        "status_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_module_status" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_module_status_pair" UNIQUE ("module_id", "status_id"),
        CONSTRAINT "FK_module_status_module" FOREIGN KEY ("module_id") REFERENCES "module"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_module_status_status" FOREIGN KEY ("status_id") REFERENCES "status"("id") ON DELETE RESTRICT
      )
    `);

    // ─── TFD ─────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "pickup_address" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying NOT NULL,
        "street" character varying NOT NULL,
        "number" character varying NOT NULL,
        "complement" character varying,
        "neighborhood" character varying NOT NULL,
        "city" character varying NOT NULL,
        "state" character varying(2) NOT NULL,
        "municipality_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_pickup_address" PRIMARY KEY ("id"),
        CONSTRAINT "FK_pickup_address_municipality" FOREIGN KEY ("municipality_id") REFERENCES "municipality"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tfd_request" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "protocol_number" character varying NOT NULL,
        "diagnosis_cid" character varying,
        "procedure_description" text,
        "justification" text,
        "request_date" date,
        "travel_date" date,
        "return_date" date,
        "transport_type" character varying,
        "estimated_cost" decimal(10,2),
        "transportation_cost" decimal(10,2),
        "food_cost" decimal(10,2),
        "hotel_cost" decimal(10,2),
        "notes" text,
        "departure_custom_address" text,
        "patient_person_id" uuid NOT NULL,
        "companion_person_id" uuid,
        "requesting_doctor_id" uuid,
        "destination_hospital_id" uuid,
        "specialty_id" uuid,
        "hotel_id" uuid,
        "pickup_address_id" uuid,
        "return_pickup_address_id" uuid,
        "municipality_id" uuid NOT NULL,
        "created_by_principal_id" uuid NOT NULL,
        "status_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_tfd_request" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tfd_request_protocol" UNIQUE ("protocol_number"),
        CONSTRAINT "FK_tfd_patient" FOREIGN KEY ("patient_person_id") REFERENCES "person"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_companion" FOREIGN KEY ("companion_person_id") REFERENCES "person"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_doctor" FOREIGN KEY ("requesting_doctor_id") REFERENCES "doctor"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_hospital" FOREIGN KEY ("destination_hospital_id") REFERENCES "hospital"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_specialty" FOREIGN KEY ("specialty_id") REFERENCES "specialty"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_hotel" FOREIGN KEY ("hotel_id") REFERENCES "hotel"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_pickup" FOREIGN KEY ("pickup_address_id") REFERENCES "pickup_address"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_return_pickup" FOREIGN KEY ("return_pickup_address_id") REFERENCES "pickup_address"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_municipality" FOREIGN KEY ("municipality_id") REFERENCES "municipality"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_principal" FOREIGN KEY ("created_by_principal_id") REFERENCES "principal"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_tfd_status" FOREIGN KEY ("status_id") REFERENCES "status"("id") ON DELETE RESTRICT
      )
    `);

    // ─── Notification & Audit ────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE "notification" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "type" character varying NOT NULL,
        "title" character varying NOT NULL,
        "message" text NOT NULL,
        "is_read" boolean NOT NULL DEFAULT false,
        "link_url" character varying,
        "recipient_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_notification" PRIMARY KEY ("id"),
        CONSTRAINT "FK_notification_recipient" FOREIGN KEY ("recipient_id") REFERENCES "principal"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id" uuid NOT NULL,
        "action" character varying NOT NULL,
        "entity_type" character varying NOT NULL,
        "entity_id" uuid NOT NULL,
        "old_values" jsonb,
        "new_values" jsonb,
        "ip_address" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMP,
        CONSTRAINT "PK_audit_log" PRIMARY KEY ("id")
      )
    `);

    // ─── Performance indexes ─────────────────────────────────────

    // TFD request composite indexes
    await queryRunner.query(`CREATE INDEX "IDX_tfd_request_municipality_status" ON "tfd_request" ("municipality_id", "status_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_tfd_request_created_by" ON "tfd_request" ("created_by_principal_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_tfd_request_municipality_created" ON "tfd_request" ("municipality_id", "created_at")`);

    // Notification indexes
    await queryRunner.query(`CREATE INDEX "IDX_notification_recipient_read" ON "notification" ("recipient_id", "is_read")`);

    // Status code index
    await queryRunner.query(`CREATE INDEX "IDX_status_code" ON "status" ("code")`);

    // Audit log indexes
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_actor" ON "audit_log" ("actor_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_entity_type" ON "audit_log" ("entity_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_log_created" ON "audit_log" ("created_at")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_log_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_log_entity_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_audit_log_actor"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_status_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_recipient_read"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tfd_request_municipality_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tfd_request_created_by"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tfd_request_municipality_status"`);

    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notification"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "tfd_request"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "pickup_address"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "module_status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "module"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "status"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "municipality_hotel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "municipality_hospital"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor_specialty"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hospital_specialty"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "doctor"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "specialty"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_contact"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "person_contact"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_address"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "person_address"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hotel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "hospital"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "municipality"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "principal_organization"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "principal_role"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "principal"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role_permission"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "permission"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "person_identification"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "person"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "contact"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "address"`);
  }
}
