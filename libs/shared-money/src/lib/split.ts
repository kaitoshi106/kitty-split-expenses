import type { ExpenseShareInput, SplitType } from '@kitty/shared-types';

export interface ComputedShare {
  memberId: string;
  shareValue: number | null;
  amountMinor: number;
}

/**
 * @description Splits an amount by weight using the largest remainder method:
 * each part gets floor(total * weight / totalWeight), then leftover minor units go
 * to the largest truncated remainders, ties broken by lower index (deterministic).
 * @param total - Amount in minor units.
 * @param weights - One non-negative weight per part.
 * @returns Parts in the same order as `weights`; their sum always equals `total`.
 * @throws {Error} SPLIT_WEIGHTS_MUST_BE_POSITIVE when the weights sum to zero or less.
 */
export function distributeByWeights(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];

  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight <= 0) {
    throw new Error('SPLIT_WEIGHTS_MUST_BE_POSITIVE');
  }

  // Integer arithmetic only; total * weight stays within safe range for realistic amounts.
  const base: number[] = new Array(n);
  const remainder: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const product = total * weights[i];
    base[i] = Math.floor(product / totalWeight);
    // Truncated fraction kept as an integer numerator for exact comparison
    remainder[i] = product - base[i] * totalWeight;
  }

  let leftover = total - base.reduce((s, v) => s + v, 0);

  // Largest remainder first; ties go to the lower index
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) =>
    remainder[b] !== remainder[a] ? remainder[b] - remainder[a] : a - b,
  );

  for (let k = 0; k < order.length && leftover > 0; k++) {
    base[order[k]] += 1;
    leftover -= 1;
  }

  return base;
}

/**
 * @description Splits an amount into `count` equal parts, distributing leftover minor units.
 * @returns Parts summing to `total`.
 */
export function splitEqually(total: number, count: number): number[] {
  return distributeByWeights(total, new Array(count).fill(1));
}

/** @description Validation error from split computation; `code` is a stable machine-readable key. */
export class SplitError extends Error {
  constructor(
    readonly code: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(code);
    this.name = 'SplitError';
  }
}

/**
 * @description Computes each member's share of an expense. Shared by the frontend
 * (live preview) and backend (persistence) so both always agree.
 * @param amountMinor - Expense amount in minor units; must be positive.
 * @param splitType - equal, exact, percent or weight.
 * @param inputs - One entry per participating member; `value` required unless equal.
 * @returns Shares in input order; their amounts always sum to `amountMinor`.
 * @throws {SplitError} On empty or duplicate members, missing values, or sums that don't match.
 */
export function computeShares(
  amountMinor: number,
  splitType: SplitType,
  inputs: ExpenseShareInput[],
): ComputedShare[] {
  if (amountMinor <= 0) {
    throw new SplitError('AMOUNT_MUST_BE_POSITIVE', { amountMinor });
  }
  if (inputs.length === 0) {
    throw new SplitError('SHARES_EMPTY');
  }

  const ids = inputs.map((i) => i.memberId);
  if (new Set(ids).size !== ids.length) {
    throw new SplitError('SHARES_DUPLICATE_MEMBER');
  }

  switch (splitType) {
    case 'equal': {
      const amounts = splitEqually(amountMinor, inputs.length);
      return inputs.map((input, i) => ({
        memberId: input.memberId,
        shareValue: null,
        amountMinor: amounts[i],
      }));
    }

    case 'exact': {
      const values = inputs.map((i) => requireValue(i, 'exact'));
      const sum = values.reduce((s, v) => s + v, 0);
      if (sum !== amountMinor) {
        throw new SplitError('SHARES_SUM_MISMATCH', {
          expected: amountMinor,
          actual: sum,
        });
      }
      return inputs.map((input, i) => ({
        memberId: input.memberId,
        shareValue: values[i],
        amountMinor: values[i],
      }));
    }

    case 'percent': {
      const values = inputs.map((i) => requireValue(i, 'percent'));
      // Percentages are user-entered decimals, so compare with a tolerance
      const sum = values.reduce((s, v) => s + v, 0);
      if (Math.abs(sum - 100) > 0.0001) {
        throw new SplitError('PERCENT_SUM_NOT_100', { actual: sum });
      }
      // Scale to integer weights, keeping 4 decimal places
      const weights = values.map((v) => Math.round(v * 10000));
      const amounts = distributeByWeights(amountMinor, weights);
      return inputs.map((input, i) => ({
        memberId: input.memberId,
        shareValue: values[i],
        amountMinor: amounts[i],
      }));
    }

    case 'weight': {
      const values = inputs.map((i) => requireValue(i, 'weight'));
      if (values.some((v) => v < 0)) {
        throw new SplitError('WEIGHT_MUST_BE_NON_NEGATIVE');
      }
      const weights = values.map((v) => Math.round(v * 10000));
      const amounts = distributeByWeights(amountMinor, weights);
      return inputs.map((input, i) => ({
        memberId: input.memberId,
        shareValue: values[i],
        amountMinor: amounts[i],
      }));
    }

    default: {
      throw new SplitError('UNKNOWN_SPLIT_TYPE', { splitType });
    }
  }
}

function requireValue(input: ExpenseShareInput, kind: string): number {
  if (input.value === undefined || input.value === null || Number.isNaN(input.value)) {
    throw new SplitError('SHARE_VALUE_REQUIRED', {
      memberId: input.memberId,
      splitType: kind,
    });
  }
  return input.value;
}

/**
 * @description Asserts that payer amounts sum to the expense amount.
 * @throws {SplitError} PAYERS_SUM_MISMATCH otherwise.
 */
export function assertPayersSum(
  amountMinor: number,
  payers: { amountMinor: number }[],
): void {
  const sum = payers.reduce((s, p) => s + p.amountMinor, 0);
  if (sum !== amountMinor) {
    throw new SplitError('PAYERS_SUM_MISMATCH', {
      expected: amountMinor,
      actual: sum,
    });
  }
}
