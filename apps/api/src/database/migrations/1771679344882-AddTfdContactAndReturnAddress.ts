import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTfdContactAndReturnAddress1771679344882 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tfd_request"
        ADD COLUMN IF NOT EXISTS "contact_phone" varchar,
        ADD COLUMN IF NOT EXISTS "departure_custom_address" text,
        ADD COLUMN IF NOT EXISTS "return_pickup_address_id" uuid REFERENCES "pickup_address"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tfd_request"
        DROP COLUMN IF EXISTS "contact_phone",
        DROP COLUMN IF EXISTS "departure_custom_address",
        DROP COLUMN IF EXISTS "return_pickup_address_id"
    `);
  }
}
