import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @deprecated Superseded by InitialSchema1742900000000.
 * Kept as empty stub for migration history compatibility.
 */
export class AddContactFieldsAndOtpToken1771679344875 implements MigrationInterface {
  name = 'AddContactFieldsAndOtpToken1771679344875';
  public async up(_queryRunner: QueryRunner): Promise<void> { /* no-op */ }
  public async down(_queryRunner: QueryRunner): Promise<void> { /* no-op */ }
}
