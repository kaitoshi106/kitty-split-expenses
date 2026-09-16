import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { api, resetDatabase, startServer, stopServer } from './harness.ts';

interface Member { id: string; name: string; role: string }

/**
 * Business rules the backend must enforce on its own; UI checks are only a convenience
 * since anyone can call the API directly.
 */
describe('Business rules (e2e)', () => {
  before(startServer);
  after(stopServer);
  beforeEach(resetDatabase);

  async function createGroup(names = ['An', 'Bình', 'Cường']) {
    const created = await api<{ token: string; group: { id: string } }>('POST', '/groups', {
      body: { name: 'Nhóm test', baseCurrency: 'VND', memberNames: names },
    });
    const token = created.body.token;
    const groupId = created.body.group.id;
    const members = await api<Member[]>('GET', `/groups/${groupId}/members`, { token });
    return { token, groupId, members: members.body };
  }

  it('rejects a payment to oneself', async () => {
    const { token, groupId, members } = await createGroup();
    const res = await api('POST', `/groups/${groupId}/payments`, {
      token,
      body: {
        fromMemberId: members[0].id,
        toMemberId: members[0].id,
        amountMinor: 100_000,
        currency: 'VND',
        paymentDate: '2026-09-12',
      },
    });
    assert.equal(res.status, 400);
    assert.equal((res.body as { error: string }).error, 'PAYMENT_SAME_MEMBER');
  });

  // Removing a member with a balance would break SUM(all balances) === 0; settle up first.
  it('rejects removing a member with a non-zero balance', async () => {
    const { token, groupId, members } = await createGroup();
    const [an, binh, cuong] = members;

    await api('POST', `/groups/${groupId}/expenses`, {
      token,
      body: {
        title: 'Bữa tối', amountMinor: 900_000, currency: 'VND', expenseDate: '2026-09-10',
        payers: [{ memberId: an.id, amountMinor: 900_000 }],
        splitType: 'equal',
        shares: [an, binh, cuong].map((m) => ({ memberId: m.id })),
      },
    });

    const res = await api('DELETE', `/groups/${groupId}/members/${binh.id}`, { token });
    assert.equal(res.status, 409);
    const body = res.body as { error: string; details: { balanceMinor: number } };
    assert.equal(body.error, 'MEMBER_HAS_BALANCE');
    assert.equal(body.details.balanceMinor, -300_000);
  });

  it('allows removing a member with a zero balance', async () => {
    const { token, groupId, members } = await createGroup();
    const res = await api('DELETE', `/groups/${groupId}/members/${members[1].id}`, { token });
    assert.equal(res.status, 204);
    assert.equal(
      (await api<Member[]>('GET', `/groups/${groupId}/members`, { token })).body.length,
      2,
    );
  });

  // A group without an admin could never be managed again.
  it('rejects removing the last admin', async () => {
    const { token, groupId, members } = await createGroup(['An', 'Bình']);
    const admin = members.find((m) => m.role === 'admin');
    assert.ok(admin, 'a new group must have at least one admin');

    const res = await api('DELETE', `/groups/${groupId}/members/${admin.id}`, { token });
    assert.equal(res.status, 409);
    assert.equal((res.body as { error: string }).error, 'LAST_ADMIN');
  });

  it('returns 404 for an unknown invite code without revealing existing groups', async () => {
    const res = await api('POST', '/groups/lookup', { body: { inviteCode: 'ZZZZZZZZ' } });
    assert.equal(res.status, 404);
  });

  it('rejects API calls without a token', async () => {
    const { groupId } = await createGroup();
    assert.equal((await api('GET', `/groups/${groupId}/expenses`)).status, 401);
  });
});
