export type NormalizedSalesOrder = {
  isValid: boolean;
  salesOrderBase: string | null;
  salesOrderDisplay: string | null;
  error: string | null;
};

function cleanValue(input: unknown): string {
  return String(input ?? "").trim();
}

/**
 * Rules:
 * - A valid Sales Order must BEGIN with 7 digits.
 * - The first 7 digits become the canonical/base Sales Order.
 * - The full entered/scanned value becomes the display Sales Order.
 *
 * Examples:
 *   1234567          -> base 1234567, display 1234567
 *   1234567.02       -> base 1234567, display 1234567.02
 *   1234567.02.ABC   -> base 1234567, display 1234567.02.ABC
 */
export function normalizeSalesOrder(input: unknown): NormalizedSalesOrder {
  const display = cleanValue(input);

  if (!display) {
    return {
      isValid: false,
      salesOrderBase: null,
      salesOrderDisplay: null,
      error: "Sales Order is required.",
    };
  }

  const match = display.match(/^(\d{7})(.*)?$/);
  if (!match) {
    return {
      isValid: false,
      salesOrderBase: null,
      salesOrderDisplay: display,
      error: "Sales Order must begin with 7 digits.",
    };
  }

  return {
    isValid: true,
    salesOrderBase: match[1],
    salesOrderDisplay: display,
    error: null,
  };
}

export function getBaseSalesOrder(input: unknown): string | null {
  const normalized = normalizeSalesOrder(input);
  return normalized.isValid ? normalized.salesOrderBase : null;
}

export function isValidSalesOrderInput(input: unknown): boolean {
  return normalizeSalesOrder(input).isValid;
}

/**
 * Transitional helper while legacy bigint sales_order still exists.
 * Use ONLY when the canonical/base SO is guaranteed numeric 7 digits.
 */
export function toLegacySalesOrderNumber(baseSalesOrder: string | null | undefined): number | null {
  const s = String(baseSalesOrder ?? "").trim();
  if (!/^\d{7}$/.test(s)) return null;

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}