const MAX_DIGITS = 10; // até 99.999.999,99

export function extractDigits(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, MAX_DIGITS);
}

export function formatDecimalMask(digits: string): string {
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  if (!Number.isFinite(cents)) return "";
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function maskDecimalInput(raw: string): string {
  return formatDecimalMask(extractDigits(raw));
}

export function centsToMaskedPrice(cents: number): string {
  return formatDecimalMask(String(Math.max(0, Math.round(cents))));
}

export function maskedPriceToCents(masked: string): number | null {
  const digits = extractDigits(masked);
  if (!digits) return null;
  return parseInt(digits, 10);
}
