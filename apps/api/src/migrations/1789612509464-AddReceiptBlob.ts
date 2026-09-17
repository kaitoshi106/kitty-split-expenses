import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stores receipt bytes in the database. The column is nullable: existing rows keep pointing
 * to files on disk, which the service falls back to, so no filesystem access is needed here.
 */
export class AddReceiptBlob1789612509464 implements MigrationInterface {
  name = 'AddReceiptBlob1789612509464';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "receipts" ADD "data" bytea`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "receipts" DROP COLUMN "data"`);
  }
}
