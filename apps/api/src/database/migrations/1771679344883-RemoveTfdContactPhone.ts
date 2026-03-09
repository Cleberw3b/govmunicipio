import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTfdContactPhone1771679344883 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tfd_request"
        DROP COLUMN IF EXISTS "contact_phone"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tfd_request"
        ADD COLUMN IF NOT EXISTS "contact_phone" varchar
    `);
  }
}
