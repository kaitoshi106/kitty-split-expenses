import type { Expense, Member, Payment } from '@kitty/shared-types';
import { buildSummaryReport } from './report';

/**
 * Figures reproduced from a reference Splid PDF export, to verify the table
 * model matches it exactly.
 *
 *   Mua rau   300,000  Huyền  →  Huyền +300,000 / −100,000, Minh −100,000, Nam −100,000
 *   Payment   100,000  Minh   →  Minh  +100,000,            Huyền −100,000
 *   Siêu thị  500,000  Minh   →  Minh  +500,000 / −166,667, Huyền −166,667, Nam −166,666
 *   Totals                       Huyền −66,667   Minh +333,333  Nam −266,666
 */

const [HUYEN, MINH, NAM] = ['m-huyen', 'm-minh', 'm-nam'];

const members: Member[] = [
  { id: HUYEN, groupId: 'g', name: 'Huyền', avatarColor: '#f00', role: 'admin' },
  { id: MINH, groupId: 'g', name: 'Minh', avatarColor: '#0f0', role: 'member' },
  { id: NAM, groupId: 'g', name: 'Nam', avatarColor: '#00f', role: 'member' },
];

function expense(
  id: string, title: string, amount: number, payer: string,
  shares: [string, number][], date: string, createdAt: string,
): Expense {
  return {
    id, groupId: 'g', categoryId: null, title,
    amountMinor: amount, currency: 'VND', fxRate: 1, amountBaseMinor: amount,
    splitType: 'equal', expenseDate: date, note: null,
    createdByMemberId: payer, createdAt, receiptId: null,
    payers: [{ memberId: payer, amountMinor: amount }],
    shares: shares.map(([memberId, amountMinor]) => ({ memberId, shareValue: null, amountMinor })),
  };
}

const expenses: Expense[] = [
  expense('e1', 'Mua rau', 300_000, HUYEN,
    [[HUYEN, 100_000], [MINH, 100_000], [NAM, 100_000]], '2026-09-09', '2026-09-13T00:00:00.000Z'),
  // 500,000 / 3 by largest remainder: 166,667 + 166,667 + 166,666
  expense('e2', 'Siêu thị', 500_000, MINH,
    [[HUYEN, 166_667], [MINH, 166_667], [NAM, 166_666]], '2026-09-16', '2026-09-16T00:00:00.000Z'),
];

const payments: Payment[] = [
  {
    id: 'p1', groupId: 'g', fromMemberId: MINH, toMemberId: HUYEN,
    amountMinor: 100_000, currency: 'VND', fxRate: 1, amountBaseMinor: 100_000,
    paymentDate: '2026-09-12', note: null, createdByMemberId: MINH,
    createdAt: '2026-09-13T00:00:00.000Z',
  },
];

function build() {
  return buildSummaryReport({
    groupName: 'Đi ăn chay',
    currency: 'VND',
    generatedAt: new Date('2026-09-16T00:00:00.000Z'),
    members, expenses, payments,
    categoryName: () => 'Chưa phân loại',
    paymentLabel: 'Chuyển tiền', simplifyDebts: true,
  });
}

describe('buildSummaryReport', () => {
  it('sorts rows by transaction date ascending', () => {
    expect(build().rows.map((r) => r.title)).toEqual(['Mua rau', 'Chuyển tiền', 'Siêu thị']);
  });

  it('keeps paid and share separate within a cell', () => {
    const row = build().rows[0]; // Mua rau
    expect(row.cells).toEqual([
      { paidMinor: 300_000, shareMinor: 100_000 }, // Huyền both paid and shared
      { paidMinor: 0, shareMinor: 100_000 },
      { paidMinor: 0, shareMinor: 100_000 },
    ]);
  });

  it('puts the sender in paid and the receiver in share', () => {
    const row = build().rows[1]; // payment: Minh → Huyền
    expect(row.byName).toBe('Minh');
    expect(row.cells).toEqual([
      { paidMinor: 0, shareMinor: 100_000 }, // Huyền receives
      { paidMinor: 100_000, shareMinor: 0 }, // Minh sends
      { paidMinor: 0, shareMinor: 0 },
    ]);
  });

  it('matches the totals of the reference export', () => {
    expect(build().totalsMinor).toEqual([-66_667, 333_333, -266_666]);
  });

  it('balances always sum to 0', () => {
    expect(build().totalsMinor.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('suggests transfers to the creditor', () => {
    expect(build().suggested).toEqual([
      { fromName: 'Nam', toName: 'Minh', amountMinor: 266_666 },
      { fromName: 'Huyền', toName: 'Minh', amountMinor: 66_667 },
    ]);
  });

  it('counts expenses, not payments, toward total spent', () => {
    expect(build().totalSpentMinor).toBe(800_000);
  });

  it('handles a group with no expenses', () => {
    const empty = buildSummaryReport({
      groupName: 'Rỗng', currency: 'VND', generatedAt: new Date(),
      members, expenses: [], payments: [],
      categoryName: () => 'Chưa phân loại', paymentLabel: 'Chuyển tiền', simplifyDebts: true,
    });
    expect(empty.rows).toEqual([]);
    expect(empty.byCategory).toEqual([]);
    expect(empty.totalsMinor).toEqual([0, 0, 0]);
  });
});

describe('buildSummaryReport — category breakdown', () => {
  const withCategories = (...totals: number[]) =>
    buildSummaryReport({
      groupName: 'g', currency: 'VND', generatedAt: new Date('2026-09-16T00:00:00.000Z'),
      members: [members[0]],
      expenses: totals.map((amount, i) =>
        expense(`c${i}`, `chi ${i}`, amount, HUYEN, [[HUYEN, amount]], '2026-09-01', '2026-09-01T00:00:00.000Z'),
      ).map((e, i) => ({ ...e, categoryId: `cat-${i}` })),
      payments: [],
      categoryName: (id) => id ?? 'none',
      paymentLabel: 'Chuyển tiền', simplifyDebts: true,
    });

  it('percentages always sum to 100, never 101 from rounding', () => {
    // 500/800 = 62.5% and 300/800 = 37.5%: both exactly at the midpoint
    const report = withCategories(500_000, 300_000);
    expect(report.byCategory.map((c) => c.percent)).toEqual([63, 37]);
    expect(report.byCategory.reduce((s, c) => s + c.percent, 0)).toBe(100);
  });

  it('three equal parts still sum to 100', () => {
    const report = withCategories(100, 100, 100);
    expect(report.byCategory.reduce((s, c) => s + c.percent, 0)).toBe(100);
  });

  it('sorts the highest-spend category first', () => {
    expect(withCategories(100, 900, 500).byCategory.map((c) => c.totalMinor))
      .toEqual([900, 500, 100]);
  });
});

describe('buildSummaryReport — spending by member', () => {
  it('sums what each member paid, not their balance', () => {
    // Huyền paid 300k, Minh 500k, Nam 0, even though Minh's balance is +333k
    expect(build().byMember).toEqual([
      { id: MINH, label: 'Minh', totalMinor: 500_000, percent: 63 },
      { id: HUYEN, label: 'Huyền', totalMinor: 300_000, percent: 37 },
    ]);
  });

  it('omits members who paid nothing instead of a 0% slice', () => {
    expect(build().byMember.map((s) => s.id)).not.toContain(NAM);
  });

  it('returns empty slices for a group with no expenses', () => {
    // distributeByWeights throws on zero total weight, so this must be guarded
    const empty = buildSummaryReport({
      groupName: 'Rỗng', currency: 'VND', generatedAt: new Date(),
      members, expenses: [], payments: [],
      categoryName: () => 'x', paymentLabel: 'Chuyển tiền', simplifyDebts: true,
    });
    expect(empty.byMember).toEqual([]);
    expect(empty.byCategory).toEqual([]);
  });
});

/**
 * The simplify-debts setting must apply to exports too.
 * Chain case: An covers Bình, Bình covers Cường. Bình nets to 0, so simplifying
 * removes Bình from the suggestions; direct debts list Bình on both sides.
 */
describe('buildSummaryReport — simplify debts setting', () => {
  const [AN, BINH, CUONG] = ['m-an', 'm-binh', 'm-cuong'];
  const three: Member[] = [
    { id: AN, groupId: 'g', name: 'An', avatarColor: '#f00', role: 'admin' },
    { id: BINH, groupId: 'g', name: 'Bình', avatarColor: '#0f0', role: 'member' },
    { id: CUONG, groupId: 'g', name: 'Cường', avatarColor: '#00f', role: 'member' },
  ];
  const chain: Expense[] = [
    expense('c1', 'Bữa 1', 300_000, AN, [[AN, 150_000], [BINH, 150_000]],
      '2026-09-01', '2026-09-01T00:00:00.000Z'),
    expense('c2', 'Bữa 2', 300_000, BINH, [[BINH, 150_000], [CUONG, 150_000]],
      '2026-09-02', '2026-09-02T00:00:00.000Z'),
  ];

  const build = (simplifyDebts: boolean) =>
    buildSummaryReport({
      groupName: 'g', currency: 'VND', generatedAt: new Date('2026-09-16T00:00:00.000Z'),
      members: three, expenses: chain, payments: [],
      categoryName: () => 'x', paymentLabel: 'Chuyển tiền', simplifyDebts,
    });

  it('on — routes around the intermediary, Bình does nothing', () => {
    expect(build(true).suggested).toEqual([
      { fromName: 'Cường', toName: 'An', amountMinor: 150_000 },
    ]);
  });

  it('off — direct pairwise debts, Bình on both sides', () => {
    const suggested = build(false).suggested;
    expect(suggested).toHaveLength(2);
    expect(suggested).toContainEqual({ fromName: 'Bình', toName: 'An', amountMinor: 150_000 });
    expect(suggested).toContainEqual({ fromName: 'Cường', toName: 'Bình', amountMinor: 150_000 });
  });

  it("either way, each member's transfers net to their balance", () => {
    for (const flag of [true, false]) {
      const r = build(flag);
      const net = new Map(r.memberNames.map((n, i) => [n, r.totalsMinor[i]]));
      for (const t of r.suggested) {
        net.set(t.fromName, (net.get(t.fromName) ?? 0) + t.amountMinor);
        net.set(t.toName, (net.get(t.toName) ?? 0) - t.amountMinor);
      }
      expect([...net.values()]).toEqual([0, 0, 0]);
    }
  });
});
