import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTfdCostColumns1771679344878 implements MigrationInterface {
  name = 'AddTfdCostColumns1771679344878';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ADD COLUMN IF NOT EXISTS "transportation_cost" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ADD COLUMN IF NOT EXISTS "food_cost" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ADD COLUMN IF NOT EXISTS "hotel_cost" numeric(10,2)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tfd_request" DROP COLUMN IF EXISTS "hotel_cost"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" DROP COLUMN IF EXISTS "food_cost"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" DROP COLUMN IF EXISTS "transportation_cost"`,
    );
  }
}
