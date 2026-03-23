import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * @deprecated Superseded by InitialSchema1742900000000.
 * Kept as empty stub for migration history compatibility.
 */
export class InitialSchema1771679344874 implements MigrationInterface {
  name = 'InitialSchema1771679344874';
  public async up(_queryRunner: QueryRunner): Promise<void> { /* no-op */ }
  public async down(_queryRunner: QueryRunner): Promise<void> { /* no-op */ }
}
