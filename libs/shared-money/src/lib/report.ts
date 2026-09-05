import type { Expense, Member, Payment } from '@kitty/shared-types';
import { calculateBalances, directDebts, minimizeTransactions } from './balance';
import { distributeByWeights } from './split';

/**
 * @description One member's cell in a report row. Paid and share are kept separate
 * rather than netted, so readers can see who fronted the money.
 */
export interface ReportCell {
  /** Amount this member paid on this row; 0 if none. */
  paidMinor: number;
  /** This member's share of this row; 0 if not involved. */
  shareMinor: number;
}

/** @description One expense or payment, with a cell per member. */
export interface ReportRow {
  kind: 'expense' | 'payment';
  title: string;
  amountMinor: number;
  /** Payer names, comma-separated when there are several. */
  byName: string;
  /** Transaction date (YYYY-MM-DD). */
  date: string;
  /** Record creation time (ISO). */
  createdOn: string;
  /** Same order as the input members. */
  cells: ReportCell[];
}

export interface ReportTransfer {
  fromName: string;
  toName: string;
  amountMinor: number;
}

/** @description A pie-chart slice aggregated by member or category. */
export interface ReportSlice {
  /** memberId or categoryId, for lookups such as avatar colors; null for uncategorized. */
  id: string | null;
  label: string;
  totalMinor: number;
  /** Integer percent; slices in the same list always sum to exactly 100. */
  percent: number;
}

/** @description Group summary for PDF/Excel export. */
export interface SummaryReport {
  groupName: string;
  currency: string;
  /** Export time (ISO). */
  generatedAt: string;
  memberNames: string[];
  rows: ReportRow[];
  /** Net balance per member, in memberNames order; always sums to 0. */
  totalsMinor: number[];
  totalSpentMinor: number;
  /** Suggested settle-up transfers. */
  suggested: ReportTransfer[];
  /** Spending by category. */
  byCategory: ReportSlice[];
  /** Amount paid by each member. */
  byMember: ReportSlice[];
}

export interface BuildReportInput {
  groupName: string;
  currency: string;
  generatedAt: Date;
  members: Member[];
  expenses: Expense[];
  payments: Payment[];
  /** Resolves a category name (null = uncategorized); injected to keep i18n out of this lib. */
  categoryName: (categoryId: string | null) => string;
  /** Localized title for payment rows. */
  paymentLabel: string;
  /**
   * The group's "simplify debts" setting. Required with no default so the export
   * always matches the settle-up screen.
   */
  simplifyDebts: boolean;
}

/**
 * @description Builds the group summary table for PDF/Excel export. Pure computation,
 * so it can be unit tested and reused by the frontend.
 * @param input - Group data plus injected labels and the simplify-debts setting.
 * @returns Rows sorted chronologically, per-member totals, settle-up suggestions and chart slices.
 */
export function buildSummaryReport(input: BuildReportInput): SummaryReport {
  const { members, expenses, payments } = input;
  const index = new Map(members.map((m, i) => [m.id, i]));
  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const blank = (): ReportCell[] => members.map(() => ({ paidMinor: 0, shareMinor: 0 }));

  const expenseRows: ReportRow[] = expenses.map((e) => {
    const cells = blank();
    for (const p of e.payers) {
      const i = index.get(p.memberId);
      if (i !== undefined) cells[i].paidMinor += p.amountMinor;
    }
    for (const s of e.shares) {
      const i = index.get(s.memberId);
      if (i !== undefined) cells[i].shareMinor += s.amountMinor;
    }
    return {
      kind: 'expense' as const,
      title: e.title,
      amountMinor: e.amountBaseMinor,
      byName: e.payers.map((p) => nameById.get(p.memberId) ?? '?').join(', '),
      date: e.expenseDate,
      createdOn: e.createdAt,
      cells,
    };
  });

  // Payments are rows too: sender goes in `paid`, receiver in `share`, so
  // paid − share yields the net balance for both kinds of row.
  const paymentRows: ReportRow[] = payments.map((p) => {
    const cells = blank();
    const from = index.get(p.fromMemberId);
    const to = index.get(p.toMemberId);
    if (from !== undefined) cells[from].paidMinor += p.amountBaseMinor;
    if (to !== undefined) cells[to].shareMinor += p.amountBaseMinor;
    return {
      kind: 'payment' as const,
      title: input.paymentLabel,
      amountMinor: p.amountBaseMinor,
      byName: nameById.get(p.fromMemberId) ?? '?',
      date: p.paymentDate,
      createdOn: p.createdAt,
      cells,
    };
  });

  // Chronological: by transaction date, then creation time
  const rows = [...expenseRows, ...paymentRows].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdOn.localeCompare(b.createdOn),
  );

  // Totals come from calculateBalances, the same source as the balances screen
  const balances = calculateBalances(members, expenses, payments);
  const balanceById = new Map(balances.map((b) => [b.memberId, b.balanceMinor]));
  const totalsMinor = members.map((m) => balanceById.get(m.id) ?? 0);

  // Same functions as the settle-up screen, so the export cannot disagree with it
  const transfers = input.simplifyDebts
    ? minimizeTransactions(balances)
    : directDebts(expenses, payments);

  const suggested = transfers.map((t) => ({
    fromName: nameById.get(t.fromMemberId) ?? '?',
    toName: nameById.get(t.toMemberId) ?? '?',
    amountMinor: t.amountMinor,
  }));

  const totalSpentMinor = expenses.reduce((s, e) => s + e.amountBaseMinor, 0);

  const byCategoryMap = new Map<string | null, number>();
  for (const e of expenses) {
    byCategoryMap.set(e.categoryId, (byCategoryMap.get(e.categoryId) ?? 0) + e.amountBaseMinor);
  }
  const byCategory = toSlices(
    [...byCategoryMap.entries()].sort((a, b) => b[1] - a[1]),
    (categoryId) => input.categoryName(categoryId),
  );

  // Amount paid, not balance: a top payer can still have a negative balance
  const spentByMember = new Map<string, number>(members.map((m) => [m.id, 0]));
  for (const e of expenses) {
    for (const p of e.payers) {
      spentByMember.set(p.memberId, (spentByMember.get(p.memberId) ?? 0) + p.amountMinor);
    }
  }
  const byMember = toSlices(
    [...spentByMember.entries()].sort((a, b) => b[1] - a[1]),
    (memberId) => nameById.get(memberId ?? '') ?? '?',
  );

  return {
    groupName: input.groupName,
    currency: input.currency,
    generatedAt: input.generatedAt.toISOString(),
    memberNames: members.map((m) => m.name),
    rows,
    totalsMinor,
    totalSpentMinor,
    suggested,
    byCategory,
    byMember,
  };
}

/**
 * @description Converts sorted [id, amount] pairs into chart slices. Percentages use
 * distributeByWeights instead of Math.round so they always sum to exactly 100
 * (rounding 500/800 and 300/800 independently gives 63 + 38 = 101).
 * @param entries - [id, amount] pairs, already sorted.
 * @param label - Resolves a display label for an id.
 * @returns Slices for positive amounts only.
 */
function toSlices<T extends string | null>(
  entries: [T, number][],
  label: (id: T) => string,
): ReportSlice[] {
  // Drop zero entries first: distributeByWeights throws on zero total weight
  // (e.g. a group with no expenses), and 0% slices only clutter the legend.
  const positive = entries.filter(([, total]) => total > 0);
  if (positive.length === 0) return [];
  const percents = distributeByWeights(100, positive.map(([, total]) => total));
  return positive.map(([id, totalMinor], i) => ({
    id,
    label: label(id),
    totalMinor,
    percent: percents[i] ?? 0,
  }));
}
