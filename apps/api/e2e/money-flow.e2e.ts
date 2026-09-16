import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import { BASE, api, resetDatabase, startServer, stopServer } from './harness.ts';

/** Minimal valid 1x1 PNG, enough to pass the API's image signature check. */
const PNG_1PX = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

/**
 * Response shapes are declared locally, not imported from @kitty/shared-types, so a field
 * renamed on both sides still fails here as the breaking HTTP change it is. This also lets
 * Node run the file directly without path aliases.
 */
interface Member { id: string; name: string }
interface Balance { memberId: string; balanceMinor: number }
interface Expense { id: string; payers: unknown[]; shares: unknown[] }
interface Expense2 { id: string }
interface Payment { id: string }

/**
 * End-to-end money flow against a real database. Each test guards a money invariant or a
 * regression that only surfaces when TypeORM meets the real schema.
 */
describe('Money flow (e2e)', () => {
  before(startServer);
  after(stopServer);
  beforeEach(resetDatabase);

  async function createGroup(names = ['An', 'Bình', 'Cường']) {
    const created = await api<{ token: string; group: { id: string } }>(
      'POST',
      '/groups',
      { body: { name: 'Nhóm test', baseCurrency: 'VND', memberNames: names } },
    );
    assert.equal(created.status, 201);

    const token = created.body.token;
    const groupId = created.body.group.id;
    const members = await api<Member[]>('GET', `/groups/${groupId}/members`, { token });
    return { token, groupId, memberIds: members.body.map((m) => m.id) };
  }

  const addExpense = (groupId: string, token: string, body: Record<string, unknown>) =>
    api<Expense>('POST', `/groups/${groupId}/expenses`, {
      token,
      body: { currency: 'VND', expenseDate: '2026-09-10', splitType: 'equal', ...body },
    });

  const balances = async (groupId: string, token: string) =>
    (await api<Balance[]>('GET', `/groups/${groupId}/balances`, { token })).body;

  it('create group, add expense, balances match a manual calculation', async () => {
    const { token, groupId, memberIds } = await createGroup();
    const [an, binh, cuong] = memberIds;

    const res = await addExpense(groupId, token, {
      title: 'Bữa tối',
      amountMinor: 900_000,
      payers: [{ memberId: an, amountMinor: 900_000 }],
      shares: memberIds.map((id) => ({ memberId: id })),
    });
    assert.equal(res.status, 201);

    const by = new Map((await balances(groupId, token)).map((b) => [b.memberId, b.balanceMinor]));
    assert.equal(by.get(an), 600_000); // paid 900k, own share 300k
    assert.equal(by.get(binh), -300_000);
    assert.equal(by.get(cuong), -300_000);
  });

  // SUM(all balances) === 0. Uneven splits also exercise remainder distribution
  // (1,000,000 / 3 = 333,334 + 333,333 + 333,333).
  it('keeps the sum of all balances at zero, even with uneven splits', async () => {
    const { token, groupId, memberIds } = await createGroup();

    for (const [i, amount] of [1_000_000, 777_777, 100].entries()) {
      const res = await addExpense(groupId, token, {
        title: `Khoản ${i + 1}`,
        amountMinor: amount,
        payers: [{ memberId: memberIds[i % 3], amountMinor: amount }],
        shares: memberIds.map((id) => ({ memberId: id })),
      });
      assert.equal(res.status, 201);
    }

    const total = (await balances(groupId, token)).reduce((s, b) => s + b.balanceMinor, 0);
    assert.equal(total, 0);
  });

  // Regression: softRemove(entity) cascades to payers/shares, which have no deleted_at
  // column, and TypeORM throws MissingDeleteDateColumnError.
  it('deletes an expense and restores it with payers and shares intact', async () => {
    const { token, groupId, memberIds } = await createGroup();

    const created = await addExpense(groupId, token, {
      title: 'Bữa tối',
      amountMinor: 900_000,
      payers: [{ memberId: memberIds[0], amountMinor: 900_000 }],
      shares: memberIds.map((id) => ({ memberId: id })),
    });
    const expenseId = created.body.id;

    assert.equal(
      (await api('DELETE', `/groups/${groupId}/expenses/${expenseId}`, { token })).status,
      204,
    );

    const trash = await api<{ kind: string; title: string }[]>(
      'GET', `/groups/${groupId}/expenses/deleted`, { token },
    );
    assert.equal(trash.body.length, 1);
    assert.equal(trash.body[0].kind, 'expense');
    assert.equal(trash.body[0].title, 'Bữa tối');

    // Deleted expenses no longer affect balances.
    assert.ok((await balances(groupId, token)).every((b) => b.balanceMinor === 0));

    assert.equal(
      (await api('POST', `/groups/${groupId}/expenses/${expenseId}/restore`, { token, body: {} }))
        .status,
      201,
    );

    const back = await api<Expense[]>('GET', `/groups/${groupId}/expenses`, { token });
    assert.equal(back.body.length, 1);
    assert.equal(back.body[0].payers.length, 1);
    assert.equal(back.body[0].shares.length, 3);
    assert.equal(
      (await balances(groupId, token)).reduce((s, b) => s + b.balanceMinor, 0),
      0,
    );
  });

  it('deletes and restores a payment', async () => {
    const { token, groupId, memberIds } = await createGroup();

    const p = await api<Payment>('POST', `/groups/${groupId}/payments`, {
      token,
      body: {
        fromMemberId: memberIds[1],
        toMemberId: memberIds[0],
        amountMinor: 300_000,
        currency: 'VND',
        paymentDate: '2026-09-12',
      },
    });
    assert.equal(p.status, 201);

    assert.equal(
      (await api('DELETE', `/groups/${groupId}/payments/${p.body.id}`, { token })).status,
      204,
    );
    assert.equal(
      (await api<unknown[]>('GET', `/groups/${groupId}/payments/deleted`, { token })).body.length,
      1,
    );

    assert.equal(
      (await api('POST', `/groups/${groupId}/payments/${p.body.id}/restore`, { token, body: {} }))
        .status,
      201,
    );
    assert.equal(
      (await api<unknown[]>('GET', `/groups/${groupId}/payments`, { token })).body.length,
      1,
    );
  });

  // Two devices can delete the same expense despite the optimistic UI.
  it('returns 404, not 500, on a second delete', async () => {
    const { token, groupId, memberIds } = await createGroup();
    const created = await addExpense(groupId, token, {
      title: 'Bữa tối',
      amountMinor: 900_000,
      payers: [{ memberId: memberIds[0], amountMinor: 900_000 }],
      shares: memberIds.map((id) => ({ memberId: id })),
    });

    const path = `/groups/${groupId}/expenses/${created.body.id}`;
    assert.equal((await api('DELETE', path, { token })).status, 204);
    assert.equal((await api('DELETE', path, { token })).status, 404);
  });

  // Soft-deleting an expense must not touch its receipt, otherwise undo restores it without one.
  it('keeps the receipt across delete and restore', async () => {
    const { token, groupId, memberIds } = await createGroup();

    const form = new FormData();
    form.append('file', new Blob([PNG_1PX], { type: 'image/png' }), 'bill.png');
    const upload = await fetch(`${BASE}/groups/${groupId}/receipts`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    assert.equal(upload.status, 201);
    const receiptId = ((await upload.json()) as { id: string }).id;

    const created = await addExpense(groupId, token, {
      title: 'Có hoá đơn',
      amountMinor: 400_000,
      receiptId,
      payers: [{ memberId: memberIds[0], amountMinor: 400_000 }],
      shares: memberIds.map((id) => ({ memberId: id })),
    });
    const path = `/groups/${groupId}/expenses/${created.body.id}`;

    await api('DELETE', path, { token });

    // The receipt is still downloadable while the expense is deleted.
    const stillThere = await fetch(`${BASE}/groups/${groupId}/receipts/${receiptId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(stillThere.status, 200);

    const restored = await api<{ receiptId: string | null }>('POST', `${path}/restore`, {
      token,
      body: {},
    });
    assert.equal(restored.body.receiptId, receiptId);
  });

  // SUM(payers) === amount; even a one-unit mismatch is rejected.
  it('rejects an expense whose payers do not sum to the amount', async () => {
    const { token, groupId, memberIds } = await createGroup();

    const res = await addExpense(groupId, token, {
      title: 'Sai tổng',
      amountMinor: 900_000,
      payers: [{ memberId: memberIds[0], amountMinor: 899_999 }],
      shares: memberIds.map((id) => ({ memberId: id })),
    });
    assert.equal(res.status, 422);
    assert.equal((res.body as { error: string }).error, 'PAYERS_SUM_MISMATCH');
  });

  it('logs activity for create and delete', async () => {
    const { token, groupId, memberIds } = await createGroup();

    const created = await addExpense(groupId, token, {
      title: 'Bữa tối',
      amountMinor: 900_000,
      payers: [{ memberId: memberIds[0], amountMinor: 900_000 }],
      shares: memberIds.map((id) => ({ memberId: id })),
    });
    await api('DELETE', `/groups/${groupId}/expenses/${created.body.id}`, { token });

    const log = await api<{ action: string; actorName: string | null }[]>(
      'GET', `/groups/${groupId}/activity`, { token },
    );
    const actions = log.body.map((e) => e.action);
    assert.ok(actions.includes('expense.created'));
    assert.ok(actions.includes('expense.deleted'));
    assert.equal(log.body[0].actorName, 'An');
  });

  // IDOR: a token for one group must not read another group.
  it('prevents a group A token from reading group B data', async () => {
    const a = await createGroup(['An']);
    const b = await createGroup(['Bình']);

    const res = await api('GET', `/groups/${b.groupId}/expenses`, { token: a.token });
    assert.equal(res.status, 403);
  });

  // iOS reports image types inconsistently (`image/heif`, or nothing), so the server
  // must sniff magic bytes instead of trusting the declared type.
  it('accepts images even when the browser declares the wrong type', async () => {
    await resetDatabase();
    const g = await api<{ token: string; group: { id: string } }>('POST', '/groups', {
      body: { name: 'Nhãn ảnh', baseCurrency: 'VND', memberNames: ['A', 'B'] },
    });
    const token = g.body.token;
    const gid = g.body.group.id;
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );

    for (const [label, description] of [
      ['image/heif', 'iPhone HEIF type'],
      ['application/octet-stream', 'generic type'],
      ['', 'no declared type'],
    ] as const) {
      const form = new FormData();
      form.append('file', new Blob([png], label ? { type: label } : {}), 'anh.png');
      const res = await fetch(`${BASE}/groups/${gid}/receipts`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      assert.equal(res.status, 201, `image must be accepted with ${description}`);
      // Stores the sniffed type, not the declared label
      assert.equal(((await res.json()) as { mimeType: string }).mimeType, 'image/png');
    }

    const form = new FormData();
    form.append('file', new Blob([Buffer.from('không phải ảnh')], { type: 'image/png' }), 'x.png');
    const bad = await fetch(`${BASE}/groups/${gid}/receipts`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: form,
    });
    assert.equal(bad.status, 400, 'a non-image file must be rejected even when declared as png');
  });


  // Repeated saves send concurrent requests with the same Idempotency-Key; a naive
  // check-then-insert would let several of them through.
  it('creates a single expense for concurrent requests with the same Idempotency-Key', async () => {
    await resetDatabase();
    const g = await api<{ token: string; group: { id: string } }>('POST', '/groups', {
      body: { name: 'Bấm nhiều lần', baseCurrency: 'VND', memberNames: ['A', 'B'] },
    });
    const token = g.body.token;
    const gid = g.body.group.id;
    const members = await api<Member[]>('GET', `/groups/${gid}/members`, { token });
    const ids = members.body.map((m) => m.id);
    const key = randomUUID(); // idempotency_key is a uuid column
    const body = {
      title: 'Chỉ nên có một', amountMinor: 300000, currency: 'VND', expenseDate: '2026-09-17',
      payers: [{ memberId: ids[0], amountMinor: 300000 }],
      splitType: 'equal', shares: ids.map((memberId) => ({ memberId })),
    };

    const send = () => fetch(`${BASE}/groups/${gid}/expenses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    });

    const responses = await Promise.all([send(), send(), send(), send(), send()]);
    for (const res of responses) {
      assert.ok(res.status < 400, `every request must succeed, got ${res.status}`);
    }
    const ids2 = (await Promise.all(responses.map((r) => r.json()))).map((e) => (e as Expense2).id);
    assert.equal(new Set(ids2).size, 1, 'all five requests must return the same expense');

    const list = await api<unknown[]>('GET', `/groups/${gid}/expenses`, { token });
    assert.equal(list.body.length, 1, 'the group must contain exactly one expense');

    // A malformed key is a client error: 400, not 500.
    const bad = await fetch(`${BASE}/groups/${gid}/expenses`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        'Idempotency-Key': 'not-a-uuid',
      },
      body: JSON.stringify(body),
    });
    assert.equal(bad.status, 400, 'a malformed Idempotency-Key must return 400');
    assert.equal(((await bad.json()) as { error: string }).error, 'IDEMPOTENCY_KEY_INVALID');
  });

});
