import type { Expense, Payment } from '@kitty/shared-types';
import fc from 'fast-check';
import {
  assertBalancesSumToZero,
  calculateBalances,
  directDebts,
  minimizeTransactions,
} from './balance';

const members = [{ id: 'emma' }, { id: 'leo' }, { id: 'hannah' }];

/** Sample trip dataset: three expenses and one payment among three members. */
function sampleExpenses(): Expense[] {
  const base = {
    groupId: 'g1',
    categoryId: null,
    currency: 'VND',
    fxRate: 1,
    splitType: 'equal' as const,
    expenseDate: '2026-09-13',
    note: null,
    createdByMemberId: 'emma',
    createdAt: '2026-09-13T00:00:00Z',
    receiptId: null,
  };
  return [
    {
      ...base,
      id: 'e1',
      title: 'Khách sạn',
      amountMinor: 900000,
      amountBaseMinor: 900000,
      payers: [{ memberId: 'emma', amountMinor: 900000 }],
      shares: [
        { memberId: 'emma', shareValue: null, amountMinor: 300000 },
        { memberId: 'leo', shareValue: null, amountMinor: 300000 },
        { memberId: 'hannah', shareValue: null, amountMinor: 300000 },
      ],
    },
    {
      ...base,
      id: 'e2',
      title: 'Siêu thị',
      amountMinor: 100000,
      amountBaseMinor: 100000,
      payers: [
        { memberId: 'emma', amountMinor: 90000 },
        { memberId: 'leo', amountMinor: 10000 },
      ],
      shares: [
        { memberId: 'emma', shareValue: null, amountMinor: 33334 },
        { memberId: 'leo', shareValue: null, amountMinor: 33333 },
        { memberId: 'hannah', shareValue: null, amountMinor: 33333 },
      ],
    },
    {
      ...base,
      id: 'e3',
      title: 'Bia',
      amountMinor: 120000,
      amountBaseMinor: 120000,
      splitType: 'weight',
      payers: [{ memberId: 'leo', amountMinor: 120000 }],
      shares: [
        { memberId: 'emma', shareValue: 1, amountMinor: 30000 },
        { memberId: 'leo', shareValue: 1, amountMinor: 30000 },
        { memberId: 'hannah', shareValue: 2, amountMinor: 60000 },
      ],
    },
  ];
}

function samplePayments(): Payment[] {
  return [
    {
      id: 'p1',
      groupId: 'g1',
      fromMemberId: 'hannah',
      toMemberId: 'emma',
      amountMinor: 200000,
      currency: 'VND',
      fxRate: 1,
      amountBaseMinor: 200000,
      paymentDate: '2026-09-13',
      note: null,
      createdByMemberId: 'hannah',
      createdAt: '2026-09-13T00:00:00Z',
    },
  ];
}

describe('calculateBalances — sample dataset', () => {
  const balances = calculateBalances(members, sampleExpenses(), samplePayments());
  const by = (id: string) => balances.find((b) => b.memberId === id)!;

  it('Emma: paid 990,000, owes 363,334, received 200,000', () => {
    expect(by('emma').paidMinor).toBe(990000);
    expect(by('emma').owedMinor).toBe(363334);
    expect(by('emma').receivedMinor).toBe(200000);
    expect(by('emma').balanceMinor).toBe(426666);
  });

  it('Leo: −233,333', () => {
    expect(by('leo').balanceMinor).toBe(-233333);
  });

  it('Hannah: −193,333', () => {
    expect(by('hannah').balanceMinor).toBe(-193333);
  });

  it('invariant: all balances sum to 0', () => {
    expect(() => assertBalancesSumToZero(balances)).not.toThrow();
  });
});

describe('minimizeTransactions', () => {
  it('produces exactly 2 transfers for the sample', () => {
    const balances = calculateBalances(members, sampleExpenses(), samplePayments());
    const transfers = minimizeTransactions(balances);
    expect(transfers).toEqual([
      { fromMemberId: 'leo', toMemberId: 'emma', amountMinor: 233333 },
      { fromMemberId: 'hannah', toMemberId: 'emma', amountMinor: 193333 },
    ]);
  });

  it('needs no transfers when every balance is 0', () => {
    expect(
      minimizeTransactions([
        { memberId: 'a', paidMinor: 0, owedMinor: 0, sentMinor: 0, receivedMinor: 0, balanceMinor: 0 },
      ]),
    ).toEqual([]);
  });

  it('property: at most n−1 transfers, and applying them zeroes every balance', () => {
    fc.assert(
      fc.property(
        // n−1 random values; the last one balances the sum to 0
        fc.array(fc.integer({ min: -1_000_000, max: 1_000_000 }), {
          minLength: 1,
          maxLength: 12,
        }),
        (head) => {
          // `0 - x` rather than `-x`: unary minus on 0 yields -0, and toBe uses
          // Object.is, which distinguishes -0 from 0.
          const last = 0 - head.reduce((s, v) => s + v, 0);
          const raw = [...head, last];
          const balances = raw.map((v, i) => ({
            memberId: `m${i}`,
            paidMinor: 0,
            owedMinor: 0,
            sentMinor: 0,
            receivedMinor: 0,
            balanceMinor: v,
          }));

          const transfers = minimizeTransactions(balances);
          const nonZero = raw.filter((v) => v !== 0).length;
          expect(transfers.length).toBeLessThanOrEqual(Math.max(0, nonZero - 1));

          // Applying every transfer must zero all balances
          const after = new Map(balances.map((b) => [b.memberId, b.balanceMinor]));
          for (const t of transfers) {
            after.set(t.fromMemberId, (after.get(t.fromMemberId) as number) + t.amountMinor);
            after.set(t.toMemberId, (after.get(t.toMemberId) as number) - t.amountMinor);
          }
          // `v + 0` normalizes -0 to +0 for Object.is comparison
          for (const v of after.values()) expect(v + 0).toBe(0);
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('directDebts — simplify off', () => {
  it('avoids intermediaries while still matching balances', () => {
    const expenses = sampleExpenses();
    const payments = samplePayments();
    const transfers = directDebts(expenses, payments);

    // Each member's net transfer flow must equal their balance
    const balances = calculateBalances(members, expenses, payments);
    const net = new Map(members.map((m) => [m.id, 0]));
    for (const t of transfers) {
      net.set(t.fromMemberId, (net.get(t.fromMemberId) as number) - t.amountMinor);
      net.set(t.toMemberId, (net.get(t.toMemberId) as number) + t.amountMinor);
    }
    for (const b of balances) {
      expect(net.get(b.memberId)).toBe(b.balanceMinor);
    }
  });
});
