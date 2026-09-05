import fc from 'fast-check';
import {
  assertPayersSum,
  computeShares,
  distributeByWeights,
  splitEqually,
  SplitError,
} from './split';

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0);

describe('distributeByWeights', () => {
  it('splits evenly when divisible', () => {
    expect(distributeByWeights(900000, [1, 1, 1])).toEqual([300000, 300000, 300000]);
  });

  it('gives the remainder to the first index when weights are equal', () => {
    // 100000 / 3 = 33333.33 → 1 leftover unit goes to index 0
    expect(distributeByWeights(100000, [1, 1, 1])).toEqual([33334, 33333, 33333]);
  });

  it('splits by weight — Hannah takes a double share', () => {
    expect(distributeByWeights(120000, [1, 1, 2])).toEqual([30000, 30000, 60000]);
  });

  it('is deterministic for the same input', () => {
    const a = distributeByWeights(100, [1, 1, 1]);
    const b = distributeByWeights(100, [1, 1, 1]);
    expect(a).toEqual(b);
  });

  it('splits 1 unit across 3 people, leaving some at 0', () => {
    expect(distributeByWeights(1, [1, 1, 1])).toEqual([1, 0, 0]);
  });

  it('throws when the total weight is 0', () => {
    expect(() => distributeByWeights(100, [0, 0])).toThrow();
  });
});

describe('splitEqually — property test', () => {
  it('invariant: parts always sum to the total', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 50 }),
        (total, count) => {
          expect(sum(splitEqually(total, count))).toBe(total);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('is fair: largest and smallest parts differ by at most 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 50 }),
        (total, count) => {
          const parts = splitEqually(total, count);
          expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('never produces negative parts', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 30 }),
        (total, count) => {
          expect(splitEqually(total, count).every((v) => v >= 0)).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('computeShares', () => {
  const ids = ['emma', 'leo', 'hannah'];
  const asInputs = (arr: { memberId: string; value?: number }[]) => arr;

  it('equal — splits evenly and distributes the remainder', () => {
    const out = computeShares(100000, 'equal', ids.map((memberId) => ({ memberId })));
    expect(out.map((s) => s.amountMinor)).toEqual([33334, 33333, 33333]);
    expect(sum(out.map((s) => s.amountMinor))).toBe(100000);
    expect(out[0].shareValue).toBeNull();
  });

  it('exact — keeps the entered amounts', () => {
    const out = computeShares(
      100000,
      'exact',
      asInputs([
        { memberId: 'emma', value: 50000 },
        { memberId: 'leo', value: 30000 },
        { memberId: 'hannah', value: 20000 },
      ]),
    );
    expect(out.map((s) => s.amountMinor)).toEqual([50000, 30000, 20000]);
  });

  it('exact — throws SHARES_SUM_MISMATCH when the sum differs', () => {
    expect(() =>
      computeShares(
        100000,
        'exact',
        asInputs([
          { memberId: 'emma', value: 50000 },
          { memberId: 'leo', value: 40000 },
        ]),
      ),
    ).toThrow(SplitError);
  });

  it('percent — converts to amounts that still sum to the total', () => {
    const out = computeShares(
      100000,
      'percent',
      asInputs([
        { memberId: 'emma', value: 50 },
        { memberId: 'leo', value: 25 },
        { memberId: 'hannah', value: 25 },
      ]),
    );
    expect(out.map((s) => s.amountMinor)).toEqual([50000, 25000, 25000]);
    expect(sum(out.map((s) => s.amountMinor))).toBe(100000);
  });

  it('percent — throws when percentages do not sum to 100', () => {
    expect(() =>
      computeShares(
        100000,
        'percent',
        asInputs([
          { memberId: 'emma', value: 50 },
          { memberId: 'leo', value: 30 },
        ]),
      ),
    ).toThrow(SplitError);
  });

  it('weight — Hannah takes 2 parts', () => {
    const out = computeShares(
      120000,
      'weight',
      asInputs([
        { memberId: 'emma', value: 1 },
        { memberId: 'leo', value: 1 },
        { memberId: 'hannah', value: 2 },
      ]),
    );
    expect(out.map((s) => s.amountMinor)).toEqual([30000, 30000, 60000]);
  });

  it('rejects duplicate members', () => {
    expect(() =>
      computeShares(1000, 'equal', [{ memberId: 'emma' }, { memberId: 'emma' }]),
    ).toThrow(SplitError);
  });

  it('rejects amounts <= 0', () => {
    expect(() => computeShares(0, 'equal', [{ memberId: 'emma' }])).toThrow(SplitError);
  });

  it('percent with fractional values keeps the sum invariant', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000_000 }), (total) => {
        const out = computeShares(total, 'percent', [
          { memberId: 'a', value: 33.3333 },
          { memberId: 'b', value: 33.3333 },
          { memberId: 'c', value: 33.3334 },
        ]);
        expect(sum(out.map((s) => s.amountMinor))).toBe(total);
      }),
      { numRuns: 300 },
    );
  });
});

describe('assertPayersSum', () => {
  it('invariant — passes when payers sum to the amount', () => {
    expect(() =>
      assertPayersSum(100000, [{ amountMinor: 90000 }, { amountMinor: 10000 }]),
    ).not.toThrow();
  });

  it('throws when the sum differs', () => {
    expect(() => assertPayersSum(100000, [{ amountMinor: 90000 }])).toThrow(SplitError);
  });
});
