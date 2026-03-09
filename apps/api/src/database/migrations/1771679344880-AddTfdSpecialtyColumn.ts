import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTfdSpecialtyColumn1771679344880 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ADD COLUMN IF NOT EXISTS "specialty_id" uuid REFERENCES "specialty"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tfd_request" DROP COLUMN IF EXISTS "specialty_id"`,
    );
  }
}
