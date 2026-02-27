import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContactFieldsAndOtpToken1771679344875
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "principal" ADD COLUMN IF NOT EXISTS "email" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "principal" ADD COLUMN IF NOT EXISTS "phone" character varying`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "otp_token" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "principal_id" uuid NOT NULL,
        "code" character varying(6) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "used_at" TIMESTAMP,
        CONSTRAINT "PK_otp_token" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "otp_token"`);
    await queryRunner.query(
      `ALTER TABLE "principal" DROP COLUMN IF EXISTS "phone"`,
    );
    await queryRunner.query(
      `ALTER TABLE "principal" DROP COLUMN IF EXISTS "email"`,
    );
  }
}
