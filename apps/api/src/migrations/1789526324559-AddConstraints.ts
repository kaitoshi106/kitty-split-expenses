import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hand-written constraints that TypeORM cannot generate from entities:
 * - CHECK constraints, enforced even when writes bypass API validation.
 * - Partial unique indexes scoped to non-deleted rows, so soft-deleted groups free their
 *   invite code and removed members free their name.
 * Also seeds the built-in categories.
 */
export class AddConstraints1789526266931 implements MigrationInterface {
  name = 'AddConstraints1789526266931';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── CHECK ───────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "groups"
        ADD CONSTRAINT "groups_name_not_blank" CHECK (length(btrim("name")) > 0)`);

    await queryRunner.query(`
      ALTER TABLE "members"
        ADD CONSTRAINT "members_name_not_blank" CHECK (length(btrim("name")) > 0),
        ADD CONSTRAINT "members_role_chk" CHECK ("role" IN ('admin', 'member'))`);

    await queryRunner.query(`
      ALTER TABLE "expenses"
        ADD CONSTRAINT "expenses_amount_positive" CHECK ("amount_minor" > 0),
        ADD CONSTRAINT "expenses_split_type_chk"
          CHECK ("split_type" IN ('equal', 'exact', 'percent', 'weight'))`);

    await queryRunner.query(`
      ALTER TABLE "expense_payers"
        ADD CONSTRAINT "expense_payers_amount_positive" CHECK ("amount_minor" > 0)`);

    // >= 0 rather than > 0: splitting 1 minor unit three ways leaves someone with 0
    await queryRunner.query(`
      ALTER TABLE "expense_shares"
        ADD CONSTRAINT "expense_shares_amount_nonneg" CHECK ("amount_minor" >= 0)`);

    await queryRunner.query(`
      ALTER TABLE "payments"
        ADD CONSTRAINT "payments_amount_positive" CHECK ("amount_minor" > 0),
        ADD CONSTRAINT "payments_different_members"
          CHECK ("from_member_id" <> "to_member_id")`);

    // ─── PARTIAL UNIQUE ──────────────────────────────────────
    // Replace plain unique indexes with ones that ignore soft-deleted rows
    await queryRunner.query(`DROP INDEX IF EXISTS "groups_invite_code_uk"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "groups_invite_code_uk"
        ON "groups" ("invite_code") WHERE "deleted_at" IS NULL`);

    // Member names must be distinguishable within a group (case- and whitespace-insensitive)
    await queryRunner.query(`
      CREATE UNIQUE INDEX "members_group_name_uk"
        ON "members" ("group_id", lower(btrim("name"))) WHERE "deleted_at" IS NULL`);

    await queryRunner.query(`DROP INDEX IF EXISTS "expenses_idempotency_uk"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "expenses_idempotency_uk"
        ON "expenses" ("group_id", "idempotency_key")
        WHERE "idempotency_key" IS NOT NULL`);

    // ─── BUILT-IN CATEGORIES (group_id NULL = visible to every group) ───
    await queryRunner.query(`
      INSERT INTO "categories" ("group_id", "name", "icon", "color", "sort_order") VALUES
        (NULL, 'Food',          'utensils',        '#F97316', 1),
        (NULL, 'Groceries',     'shopping-basket', '#22C55E', 2),
        (NULL, 'Travel',        'plane',           '#0EA5E9', 3),
        (NULL, 'Transport',     'car',             '#6366F1', 4),
        (NULL, 'Entertainment', 'party-popper',    '#EC4899', 5),
        (NULL, 'Bills',         'receipt',         '#EF4444', 6),
        (NULL, 'Shopping',      'shopping-bag',    '#A855F7', 7)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "categories" WHERE "group_id" IS NULL`);

    await queryRunner.query(`DROP INDEX IF EXISTS "expenses_idempotency_uk"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "expenses_idempotency_uk"
        ON "expenses" ("group_id", "idempotency_key")`);

    await queryRunner.query(`DROP INDEX IF EXISTS "members_group_name_uk"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "groups_invite_code_uk"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "groups_invite_code_uk" ON "groups" ("invite_code")`);

    await queryRunner.query(`
      ALTER TABLE "payments"
        DROP CONSTRAINT "payments_different_members",
        DROP CONSTRAINT "payments_amount_positive"`);
    await queryRunner.query(`
      ALTER TABLE "expense_shares" DROP CONSTRAINT "expense_shares_amount_nonneg"`);
    await queryRunner.query(`
      ALTER TABLE "expense_payers" DROP CONSTRAINT "expense_payers_amount_positive"`);
    await queryRunner.query(`
      ALTER TABLE "expenses"
        DROP CONSTRAINT "expenses_split_type_chk",
        DROP CONSTRAINT "expenses_amount_positive"`);
    await queryRunner.query(`
      ALTER TABLE "members"
        DROP CONSTRAINT "members_role_chk",
        DROP CONSTRAINT "members_name_not_blank"`);
    await queryRunner.query(`
      ALTER TABLE "groups" DROP CONSTRAINT "groups_name_not_blank"`);
  }
}
