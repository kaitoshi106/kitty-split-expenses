import { MigrationInterface, QueryRunner } from "typeorm";

export class AddReceipts1789531897557 implements MigrationInterface {
    name = 'AddReceipts1789531897557'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."members_group_name_uk"`);
        await queryRunner.query(`ALTER TABLE "members" DROP CONSTRAINT "members_name_not_blank"`);
        await queryRunner.query(`ALTER TABLE "members" DROP CONSTRAINT "members_role_chk"`);
        await queryRunner.query(`ALTER TABLE "expense_payers" DROP CONSTRAINT "expense_payers_amount_positive"`);
        await queryRunner.query(`ALTER TABLE "expense_shares" DROP CONSTRAINT "expense_shares_amount_nonneg"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "expenses_amount_positive"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "expenses_split_type_chk"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "payments_amount_positive"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "payments_different_members"`);
        await queryRunner.query(`ALTER TABLE "groups" DROP CONSTRAINT "groups_name_not_blank"`);
        await queryRunner.query(`CREATE TABLE "receipts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid NOT NULL, "filename" character varying(120) NOT NULL, "original_name" character varying(255) NOT NULL, "mime_type" character varying(100) NOT NULL, "size_bytes" bigint NOT NULL, "uploaded_by_member_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_5e8182d7c29e023da6e1ff33bfe" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "receipts_group_idx" ON "receipts" ("group_id") `);
        await queryRunner.query(`ALTER TABLE "expenses" ADD "receipt_id" uuid`);
        await queryRunner.query(`ALTER TABLE "receipts" ADD CONSTRAINT "FK_e439237a99d401ccd3bca3c0a83" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "receipts" ADD CONSTRAINT "FK_db1e832d55bcccf69463b2cf389" FOREIGN KEY ("uploaded_by_member_id") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "receipts" DROP CONSTRAINT "FK_db1e832d55bcccf69463b2cf389"`);
        await queryRunner.query(`ALTER TABLE "receipts" DROP CONSTRAINT "FK_e439237a99d401ccd3bca3c0a83"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP COLUMN "receipt_id"`);
        await queryRunner.query(`DROP INDEX "public"."receipts_group_idx"`);
        await queryRunner.query(`DROP TABLE "receipts"`);
        await queryRunner.query(`ALTER TABLE "groups" ADD CONSTRAINT "groups_name_not_blank" CHECK ((length(btrim((name)::text)) > 0))`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "payments_different_members" CHECK ((from_member_id <> to_member_id))`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ((amount_minor > 0))`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "expenses_split_type_chk" CHECK (((split_type)::text = ANY ((ARRAY['equal'::character varying, 'exact'::character varying, 'percent'::character varying, 'weight'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_positive" CHECK ((amount_minor > 0))`);
        await queryRunner.query(`ALTER TABLE "expense_shares" ADD CONSTRAINT "expense_shares_amount_nonneg" CHECK ((amount_minor >= 0))`);
        await queryRunner.query(`ALTER TABLE "expense_payers" ADD CONSTRAINT "expense_payers_amount_positive" CHECK ((amount_minor > 0))`);
        await queryRunner.query(`ALTER TABLE "members" ADD CONSTRAINT "members_role_chk" CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'member'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "members" ADD CONSTRAINT "members_name_not_blank" CHECK ((length(btrim((name)::text)) > 0))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "members_group_name_uk" ON "members" ("group_id") WHERE (deleted_at IS NULL)`);
    }

}
