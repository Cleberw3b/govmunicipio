import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @deprecated Superseded by InitialSchema1742900000000.
 * Kept as empty stub for migration history compatibility.
 */
export class AddPickupAddress1771679344881 implements MigrationInterface {
  name = 'AddPickupAddress1771679344881';
  public async up(_queryRunner: QueryRunner): Promise<void> { /* no-op */ }
  public async down(_queryRunner: QueryRunner): Promise<void> { /* no-op */ }
}
