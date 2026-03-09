import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPickupAddress1771679344881 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "pickup_address" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" varchar NOT NULL,
        "street" varchar NOT NULL,
        "number" varchar NOT NULL,
        "complement" varchar,
        "neighborhood" varchar NOT NULL,
        "city" varchar NOT NULL,
        "state" varchar(2) NOT NULL,
        "municipality_id" uuid NOT NULL REFERENCES "municipality"("id") ON DELETE CASCADE,
        CONSTRAINT "PK_pickup_address" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ADD COLUMN IF NOT EXISTS "pickup_address_id" uuid REFERENCES "pickup_address"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tfd_request" DROP COLUMN IF EXISTS "pickup_address_id"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "pickup_address"`);
  }
}
