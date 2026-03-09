import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpecialtySigtapSchema1771679344877 implements MigrationInterface {
  name = 'SpecialtySigtapSchema1771679344877';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Clear existing specialty data before schema change
    await queryRunner.query(`DELETE FROM "doctor_specialty"`);
    await queryRunner.query(`DELETE FROM "hospital_specialty"`);
    await queryRunner.query(`DELETE FROM "specialty"`);

    // Drop old unique constraint on name
    await queryRunner.query(
      `ALTER TABLE "specialty" DROP CONSTRAINT IF EXISTS "UQ_6caedcf8a5f84e3072c5a380a16"`,
    );

    // Drop old name column constraints / rename approach
    // Add new columns
    await queryRunner.query(
      `ALTER TABLE "specialty" ADD COLUMN IF NOT EXISTS "code" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "specialty" ADD COLUMN IF NOT EXISTS "group_code" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "specialty" ADD COLUMN IF NOT EXISTS "group_name" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "specialty" ADD COLUMN IF NOT EXISTS "price" numeric(10,2) NOT NULL DEFAULT 0`,
    );

    // Make name NOT have unique constraint (it was unique before)
    // Make code unique
    await queryRunner.query(
      `UPDATE "specialty" SET "code" = "name" WHERE "code" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "specialty" ALTER COLUMN "code" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "specialty" ADD CONSTRAINT "UQ_specialty_code" UNIQUE ("code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "specialty" DROP CONSTRAINT IF EXISTS "UQ_specialty_code"`,
    );
    await queryRunner.query(`ALTER TABLE "specialty" DROP COLUMN IF EXISTS "price"`);
    await queryRunner.query(`ALTER TABLE "specialty" DROP COLUMN IF EXISTS "group_name"`);
    await queryRunner.query(`ALTER TABLE "specialty" DROP COLUMN IF EXISTS "group_code"`);
    await queryRunner.query(`ALTER TABLE "specialty" DROP COLUMN IF EXISTS "code"`);
    await queryRunner.query(
      `ALTER TABLE "specialty" ADD CONSTRAINT "UQ_6caedcf8a5f84e3072c5a380a16" UNIQUE ("name")`,
    );
  }
}
