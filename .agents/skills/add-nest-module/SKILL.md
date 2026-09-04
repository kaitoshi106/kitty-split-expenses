---
name: add-nest-module
description: Workflow for adding a NestJS module to apps/api/src/modules/. Order DTO → service → controller, transactions for multi-table writes, the two stacked guards, and the error-code format.
---

# Workflow: add a NestJS module

## Scaffold

Nx 21 generators take a file path (there is no `--project` flag):

```bash
pnpm nx g @nx/nest:module     apps/api/src/modules/<name>/<name>
pnpm nx g @nx/nest:controller apps/api/src/modules/<name>/<name>
pnpm nx g @nx/nest:service    apps/api/src/modules/<name>/<name>
```

Or write the three files by hand, following `modules/payments/` as the reference module.

## Order of work

**1 · DTO first** — `modules/<name>/dto/<name>.dto.ts`

```ts
export class CreateThingBody {
  @IsString() @Length(1, 120)   title!: string;
  @IsInt() @Min(1)              amountMinor!: number;
  @IsString() @Length(3, 3)     currency!: string;
}

export class UpdateThingBody extends CreateThingBody {}
```

The DTO is the contract: written first, it tells both controller and service exactly what they receive. Request classes are named `…Body`; the matching interfaces shared with the frontend (`CreateThingDto`) live in `libs/shared-types`. Nested arrays need `@ValidateNested({ each: true }) @Type(() => Child)` — see `expenses/dto/expense.dto.ts`. The global `ValidationPipe` (in `app.module.ts`) runs with `whitelist` and `transform`.

**2 · Service** — business logic and data access

- Never takes `Request`/`Response`
- Writes to several tables → wrap them in `this.dataSource.transaction(async (manager) => …)`
- Changes to group data log an entry with `this.activity.log(manager, {…})` inside the same transaction (`ActivityModule` is `@Global`, so just inject `ActivityService`)
- Money calculations come from `@kitty/shared-money` (`computeShares`, `calculateBalances`…), never re-implemented
- Entities map to shared-types through `common/mappers.ts`
- Business errors use `AppError` (`common/app-error.ts`) with a **machine-readable code**:

```ts
throw AppError.unprocessable('SHARES_SUM_MISMATCH', 'Shares do not add up to the amount', {
  expected,
  actual,
});
```

`AllExceptionsFilter` sends every error as `{ statusCode, error, message, details? }`. Clients branch on `error`, never on `message`. A new code the user can hit should also get a translation key in `apps/web/src/app/core/interceptors/error.interceptor.ts`.

**3 · Controller** — thin

```ts
@ApiTags('Things')
@ApiBearerAuth('token')
@Controller('groups/:gid/things')
@UseGuards(GroupMemberGuard)
export class ThingsController {
  constructor(private readonly things: ThingsService) {}

  @Post()
  create(
    @Param('gid', ParseUUIDPipe) gid: string,
    @CurrentMember() me: MemberContext,
    @Body() body: CreateThingBody,
  ): Promise<Thing> {
    return this.things.create(gid, me.memberId, body);
  }
}
```

Guards stack in two layers: the global `JwtAuthGuard` (`APP_GUARD`) proves the token is valid; `GroupMemberGuard` proves it belongs to the `:gid` in the URL. Add `AdminGuard` on admin-only routes, and `@Public()` only on routes that must work without a token (group create/join).

**4 · Register the module**

```ts
@Module({
  imports: [TypeOrmModule.forFeature([ThingEntity, MemberEntity])],
  controllers: [ThingsController],
  providers: [ThingsService],
  exports: [ThingsService], // only if another module needs it
})
export class ThingsModule {}
```

Add it to the `imports` of `AppModule` (`apps/api/src/app/app.module.ts`). A new table also needs an entity and a migration — see [`add-migration`](../add-migration/SKILL.md).

**5 · Test**

Business rules and money flows are covered end-to-end in `apps/api/e2e/` (`node:test` against a real server and database; run with `pnpm e2e` after `pnpm db:up`). Add cases there for every rule the backend must enforce, and assert the `SUM` invariants for anything that moves money. Pure logic gets a Jest `*.spec.ts` next to the file.

## Checklist

- [ ] Controller holds no business logic
- [ ] Service knows nothing about HTTP
- [ ] `GroupMemberGuard` on every route under `/groups/:gid/*`
- [ ] `ParseUUIDPipe` on every id param
- [ ] Multi-table write → transaction, with the activity entry inside it
- [ ] Errors carry an `error` code, not just a `message`
- [ ] Soft-deleted rows excluded (`deleted_at IS NULL` in query builders; TypeORM `find*` does this automatically for `@DeleteDateColumn` entities)

Conventions: [`.agents/rules/03-backend.md`](../../rules/03-backend.md).
