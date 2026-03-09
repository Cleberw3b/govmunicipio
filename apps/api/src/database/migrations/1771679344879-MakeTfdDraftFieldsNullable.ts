import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeTfdDraftFieldsNullable1771679344879
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "requesting_doctor_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "destination_hospital_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "diagnosis_cid" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "procedure_description" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "justification" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "request_date" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "transport_type" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "transport_type" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "request_date" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "justification" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "procedure_description" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "diagnosis_cid" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "destination_hospital_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tfd_request" ALTER COLUMN "requesting_doctor_id" SET NOT NULL`,
    );
  }
}
