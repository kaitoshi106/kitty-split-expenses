import { ValueTransformer } from 'typeorm';

/**
 * Required on every money column (minor units). The pg driver returns BIGINT as a string,
 * so without this `a.amountMinor + b.amountMinor` concatenates ("100" + "200" = "100200").
 * Converting to `number` is safe because realistic amounts stay far below 2^53.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/** NUMERIC columns also arrive as strings; used for fx_rate and share_value. */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
