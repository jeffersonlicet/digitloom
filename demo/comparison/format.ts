/** @fileoverview Shares exact display formatting across comparison renderers. */
import type { NumberFormat } from "../usePlayground";

export const FORMAT_OPTIONS: Record<
  NumberFormat,
  Intl.NumberFormatOptions & { notation?: "standard" | "compact" }
> = {
  decimal: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  currency: {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
  percent: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
};
const decimal = new Intl.NumberFormat("en-US", FORMAT_OPTIONS.decimal);
const currency = new Intl.NumberFormat("en-US", FORMAT_OPTIONS.currency);
export const FORMATTERS: Record<NumberFormat, (value: number) => string> = {
  decimal: decimal.format,
  currency: currency.format,
  percent: (value) => `${decimal.format(value)}%`,
};
