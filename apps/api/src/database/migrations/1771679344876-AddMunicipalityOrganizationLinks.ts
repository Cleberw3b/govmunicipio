import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMunicipalityOrganizationLinks1771679344876 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "municipality_hospital" (
        "municipality_id" uuid NOT NULL REFERENCES "municipality"("id") ON DELETE CASCADE,
        "hospital_id" uuid NOT NULL REFERENCES "hospital"("id") ON DELETE CASCADE,
        CONSTRAINT "PK_municipality_hospital" PRIMARY KEY ("municipality_id", "hospital_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "municipality_hotel" (
        "municipality_id" uuid NOT NULL REFERENCES "municipality"("id") ON DELETE CASCADE,
        "hotel_id" uuid NOT NULL REFERENCES "hotel"("id") ON DELETE CASCADE,
        CONSTRAINT "PK_municipality_hotel" PRIMARY KEY ("municipality_id", "hotel_id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "municipality_hotel" ("municipality_id", "hotel_id")
      SELECT "municipality_id", "id"
      FROM "hotel"
      WHERE "municipality_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      ALTER TABLE "hotel" DROP COLUMN IF EXISTS "municipality_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hotel" ADD COLUMN IF NOT EXISTS "municipality_id" uuid REFERENCES "municipality"("id")
    `);

    await queryRunner.query(`
      UPDATE "hotel" h
      SET "municipality_id" = mh."municipality_id"
      FROM "municipality_hotel" mh
      WHERE mh."hotel_id" = h."id"
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS "municipality_hotel"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "municipality_hospital"`);
  }
}
