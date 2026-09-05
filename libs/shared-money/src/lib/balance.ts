import type { Balance, Expense, Member, Payment, Transfer } from '@kitty/shared-types';

/**
 * @description Derives member balances from expenses and payments; balances are never stored.
 *
 *   balance = paid + sent − owed − received
 *   > 0  the group owes this member
 *   < 0  this member owes the group
 *
 * Invariant: the balances of all members sum to 0.
 * @param members - Every member to include, even with no activity.
 * @param expenses - Expenses with payers and shares in minor units.
 * @param payments - Payments, counted in the group's base currency.
 * @returns One balance row per member.
 */
export function calculateBalances(
  members: Pick<Member, 'id'>[],
  expenses: Expense[],
  payments: Payment[],
): Balance[] {
  const acc = new Map<string, Balance>();
  for (const m of members) {
    acc.set(m.id, {
      memberId: m.id,
      paidMinor: 0,
      owedMinor: 0,
      sentMinor: 0,
      receivedMinor: 0,
      balanceMinor: 0,
    });
  }

  for (const e of expenses) {
    for (const p of e.payers) {
      const row = acc.get(p.memberId);
      if (row) row.paidMinor += p.amountMinor;
    }
    for (const s of e.shares) {
      const row = acc.get(s.memberId);
      if (row) row.owedMinor += s.amountMinor;
    }
  }

  for (const p of payments) {
    const from = acc.get(p.fromMemberId);
    if (from) from.sentMinor += p.amountBaseMinor;
    const to = acc.get(p.toMemberId);
    if (to) to.receivedMinor += p.amountBaseMinor;
  }

  const result = [...acc.values()];
  for (const r of result) {
    r.balanceMinor =
      r.paidMinor + r.sentMinor - r.owedMinor - r.receivedMinor;
  }
  return result;
}

/**
 * @description Development check: a non-zero sum means a rounding/distribution bug.
 * @throws {Error} BALANCE_INVARIANT_VIOLATED when balances do not sum to zero.
 */
export function assertBalancesSumToZero(balances: Balance[]): void {
  const sum = balances.reduce((s, b) => s + b.balanceMinor, 0);
  if (sum !== 0) {
    throw new Error(`BALANCE_INVARIANT_VIOLATED: sum=${sum}`);
  }
}

/**
 * @description Greedily matches the largest creditors with the largest debtors.
 * Used for group settle-up and per-expense direct debts.
 * @param entries - Net amounts that must sum to zero.
 * @returns At most n−1 transfers that bring every amount to zero.
 */
function greedyMatch(entries: { id: string; amount: number }[]): Transfer[] {
  const creditors = entries
    .filter((e) => e.amount > 0)
    .map((e) => ({ ...e }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const debtors = entries
    .filter((e) => e.amount < 0)
    .map((e) => ({ id: e.id, amount: -e.amount }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const amount = Math.min(c.amount, d.amount);

    if (amount > 0) {
      transfers.push({ fromMemberId: d.id, toMemberId: c.id, amountMinor: amount });
    }

    c.amount -= amount;
    d.amount -= amount;
    if (c.amount === 0) ci++;
    if (d.amount === 0) di++;
  }

  return transfers;
}

/**
 * @description Settle-up plan for the whole group when "simplify debts" is on.
 * Greedy matching yields at most n−1 transfers; the exact minimum is NP-hard.
 * @param balances - Balances that sum to zero.
 * @returns Transfers that settle every balance.
 */
export function minimizeTransactions(balances: Balance[]): Transfer[] {
  return greedyMatch(
    balances.map((b) => ({ id: b.memberId, amount: b.balanceMinor })),
  );
}

/**
 * @description Pairwise debts when "simplify debts" is off, so members only owe
 * people they actually shared expenses with.
 *
 * Each expense is netted (paid − owed, summing to 0) and matched greedily on its
 * own, then pairs are aggregated. Splitting each debt proportionally across payers
 * would compound rounding errors and drift from the balances; per-expense netting
 * stays exact.
 * @param expenses - Expenses with payers and shares in minor units.
 * @param payments - Payments that reduce existing debts.
 * @returns Net transfers per member pair, largest first.
 */
export function directDebts(expenses: Expense[], payments: Payment[]): Transfer[] {
  // "debtor|creditor" -> amount
  const pair = new Map<string, number>();
  const add = (from: string, to: string, amount: number) => {
    if (from === to || amount === 0) return;
    const k = `${from}|${to}`;
    pair.set(k, (pair.get(k) ?? 0) + amount);
  };

  for (const e of expenses) {
    const net = new Map<string, number>();
    for (const p of e.payers) {
      net.set(p.memberId, (net.get(p.memberId) ?? 0) + p.amountMinor);
    }
    for (const s of e.shares) {
      net.set(s.memberId, (net.get(s.memberId) ?? 0) - s.amountMinor);
    }
    const entries = [...net.entries()].map(([id, amount]) => ({ id, amount }));
    for (const t of greedyMatch(entries)) {
      add(t.fromMemberId, t.toMemberId, t.amountMinor);
    }
  }

  // A payment reduces what `from` owes `to`, so record it in the opposite direction
  for (const p of payments) {
    add(p.toMemberId, p.fromMemberId, p.amountBaseMinor);
  }

  // Net opposite directions: A owes B 100 and B owes A 30 → A owes B 70
  const seen = new Set<string>();
  const result: Transfer[] = [];

  for (const [key, amount] of pair) {
    const [from, to] = key.split('|');
    const unordered = [from, to].sort().join('|');
    if (seen.has(unordered)) continue;
    seen.add(unordered);

    const reverse = pair.get(`${to}|${from}`) ?? 0;
    const netAmount = amount - reverse;

    if (netAmount > 0) {
      result.push({ fromMemberId: from, toMemberId: to, amountMinor: netAmount });
    } else if (netAmount < 0) {
      result.push({ fromMemberId: to, toMemberId: from, amountMinor: -netAmount });
    }
  }

  return result.sort(
    (a, b) =>
      b.amountMinor - a.amountMinor ||
      a.fromMemberId.localeCompare(b.fromMemberId),
  );
}
