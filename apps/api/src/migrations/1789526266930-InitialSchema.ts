import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789526266930 implements MigrationInterface {
    name = 'InitialSchema1789526266930'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid, "name" character varying(40) NOT NULL, "icon" character varying(40) NOT NULL, "color" character(7) NOT NULL DEFAULT '#94A3B8', "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "categories_group_idx" ON "categories" ("group_id") `);
        await queryRunner.query(`CREATE TABLE "members" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid NOT NULL, "name" character varying(60) NOT NULL, "avatar_color" character(7) NOT NULL DEFAULT '#6366F1', "role" character varying(10) NOT NULL DEFAULT 'member', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_28b53062261b996d9c99fa12404" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "members_group_idx" ON "members" ("group_id") `);
        await queryRunner.query(`CREATE TABLE "expense_payers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expense_id" uuid NOT NULL, "member_id" uuid NOT NULL, "amount_minor" bigint NOT NULL, CONSTRAINT "PK_525982bdd24d079bb119776db9a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "expense_payers_member_idx" ON "expense_payers" ("member_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "expense_payers_uk" ON "expense_payers" ("expense_id", "member_id") `);
        await queryRunner.query(`CREATE TABLE "expense_shares" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "expense_id" uuid NOT NULL, "member_id" uuid NOT NULL, "share_value" numeric(18,4), "amount_minor" bigint NOT NULL, CONSTRAINT "PK_6797467a312af7a82082f86dc91" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "expense_shares_member_idx" ON "expense_shares" ("member_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "expense_shares_uk" ON "expense_shares" ("expense_id", "member_id") `);
        await queryRunner.query(`CREATE TABLE "expenses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid NOT NULL, "category_id" uuid, "title" character varying(120) NOT NULL, "amount_minor" bigint NOT NULL, "currency" character(3) NOT NULL, "fx_rate" numeric(18,8) NOT NULL DEFAULT '1', "amount_base_minor" bigint NOT NULL, "split_type" character varying(10) NOT NULL DEFAULT 'equal', "expense_date" date NOT NULL, "note" text, "created_by_member_id" uuid NOT NULL, "idempotency_key" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_94c3ceb17e3140abc9282c20610" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "expenses_idempotency_uk" ON "expenses" ("group_id", "idempotency_key") `);
        await queryRunner.query(`CREATE INDEX "expenses_category_idx" ON "expenses" ("category_id") `);
        await queryRunner.query(`CREATE INDEX "expenses_group_date_idx" ON "expenses" ("group_id", "expense_date") `);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid NOT NULL, "from_member_id" uuid NOT NULL, "to_member_id" uuid NOT NULL, "amount_minor" bigint NOT NULL, "currency" character(3) NOT NULL, "fx_rate" numeric(18,8) NOT NULL DEFAULT '1', "amount_base_minor" bigint NOT NULL, "payment_date" date NOT NULL, "note" text, "created_by_member_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "payments_group_date_idx" ON "payments" ("group_id", "payment_date") `);
        await queryRunner.query(`CREATE TABLE "groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "base_currency" character(3) NOT NULL DEFAULT 'VND', "invite_code" character varying(8) NOT NULL, "photo_url" text, "simplify_debts" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_659d1483316afb28afd3a90646e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "groups_invite_code_uk" ON "groups" ("invite_code") `);
        await queryRunner.query(`CREATE TABLE "group_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid NOT NULL, "member_id" uuid NOT NULL, "jti" uuid NOT NULL, "user_agent" text, "last_seen_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "revoked_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_6b281f0ab94792fad0cf2ed026f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "group_sessions_jti_uk" ON "group_sessions" ("jti") `);
        await queryRunner.query(`CREATE INDEX "group_sessions_member_idx" ON "group_sessions" ("member_id") `);
        await queryRunner.query(`CREATE TABLE "activity_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_id" uuid NOT NULL, "actor_member_id" uuid, "action" character varying(40) NOT NULL, "entity_type" character varying(20) NOT NULL, "entity_id" uuid NOT NULL, "snapshot" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f25287b6140c5ba18d38776a796" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "activity_logs_group_time_idx" ON "activity_logs" ("group_id", "created_at") `);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_9cb2a5ee5d6a59afa025f3b96d7" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "members" ADD CONSTRAINT "FK_b9dc6083fb1fc597d2018a19e84" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense_payers" ADD CONSTRAINT "FK_9a3866437d6ba9c95d2841a6693" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense_payers" ADD CONSTRAINT "FK_43d222c683e40914c20a8720ffa" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense_shares" ADD CONSTRAINT "FK_07f2ba1f3ce16fa4bf7cb10231e" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expense_shares" ADD CONSTRAINT "FK_e5ade6f521d8eed1727f49808c4" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_d4e9271763ee685f5d746a4e550" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_5d1f4be708e0dfe2afa1a3c376c" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "expenses" ADD CONSTRAINT "FK_0c4196887e02d9191e6e750d72b" FOREIGN KEY ("created_by_member_id") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_921c6d19b1de7071743a06f50fc" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_b7fff33a5b2c126bff9534151f5" FOREIGN KEY ("from_member_id") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_9f68533571f07dd3d2edb00e2d7" FOREIGN KEY ("to_member_id") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_sessions" ADD CONSTRAINT "FK_1ce35dde09434e6c5000d6be8fe" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "group_sessions" ADD CONSTRAINT "FK_79280d67909161f9c77cb36b42c" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_ba105973b6f2ba3897870c32237" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_fcdd0fc1f0bf2194b632d70d233" FOREIGN KEY ("actor_member_id") REFERENCES "members"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "activity_logs" DROP CONSTRAINT "FK_fcdd0fc1f0bf2194b632d70d233"`);
        await queryRunner.query(`ALTER TABLE "activity_logs" DROP CONSTRAINT "FK_ba105973b6f2ba3897870c32237"`);
        await queryRunner.query(`ALTER TABLE "group_sessions" DROP CONSTRAINT "FK_79280d67909161f9c77cb36b42c"`);
        await queryRunner.query(`ALTER TABLE "group_sessions" DROP CONSTRAINT "FK_1ce35dde09434e6c5000d6be8fe"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_9f68533571f07dd3d2edb00e2d7"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_b7fff33a5b2c126bff9534151f5"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_921c6d19b1de7071743a06f50fc"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_0c4196887e02d9191e6e750d72b"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_5d1f4be708e0dfe2afa1a3c376c"`);
        await queryRunner.query(`ALTER TABLE "expenses" DROP CONSTRAINT "FK_d4e9271763ee685f5d746a4e550"`);
        await queryRunner.query(`ALTER TABLE "expense_shares" DROP CONSTRAINT "FK_e5ade6f521d8eed1727f49808c4"`);
        await queryRunner.query(`ALTER TABLE "expense_shares" DROP CONSTRAINT "FK_07f2ba1f3ce16fa4bf7cb10231e"`);
        await queryRunner.query(`ALTER TABLE "expense_payers" DROP CONSTRAINT "FK_43d222c683e40914c20a8720ffa"`);
        await queryRunner.query(`ALTER TABLE "expense_payers" DROP CONSTRAINT "FK_9a3866437d6ba9c95d2841a6693"`);
        await queryRunner.query(`ALTER TABLE "members" DROP CONSTRAINT "FK_b9dc6083fb1fc597d2018a19e84"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_9cb2a5ee5d6a59afa025f3b96d7"`);
        await queryRunner.query(`DROP INDEX "public"."activity_logs_group_time_idx"`);
        await queryRunner.query(`DROP TABLE "activity_logs"`);
        await queryRunner.query(`DROP INDEX "public"."group_sessions_member_idx"`);
        await queryRunner.query(`DROP INDEX "public"."group_sessions_jti_uk"`);
        await queryRunner.query(`DROP TABLE "group_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."groups_invite_code_uk"`);
        await queryRunner.query(`DROP TABLE "groups"`);
        await queryRunner.query(`DROP INDEX "public"."payments_group_date_idx"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP INDEX "public"."expenses_group_date_idx"`);
        await queryRunner.query(`DROP INDEX "public"."expenses_category_idx"`);
        await queryRunner.query(`DROP INDEX "public"."expenses_idempotency_uk"`);
        await queryRunner.query(`DROP TABLE "expenses"`);
        await queryRunner.query(`DROP INDEX "public"."expense_shares_uk"`);
        await queryRunner.query(`DROP INDEX "public"."expense_shares_member_idx"`);
        await queryRunner.query(`DROP TABLE "expense_shares"`);
        await queryRunner.query(`DROP INDEX "public"."expense_payers_uk"`);
        await queryRunner.query(`DROP INDEX "public"."expense_payers_member_idx"`);
        await queryRunner.query(`DROP TABLE "expense_payers"`);
        await queryRunner.query(`DROP INDEX "public"."members_group_idx"`);
        await queryRunner.query(`DROP TABLE "members"`);
        await queryRunner.query(`DROP INDEX "public"."categories_group_idx"`);
        await queryRunner.query(`DROP TABLE "categories"`);
    }

}
