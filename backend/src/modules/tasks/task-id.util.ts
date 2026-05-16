/**
 * Tenant nomidan 2-3 harfli abbreviatura chiqaradi.
 * "Vodiy Print" → "VP", "Sharq Reklama" → "SR", "ABC" → "AB"
 */
export function tenantAbbrev(tenantName: string): string {
  const words = tenantName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
}

/**
 * Xizmat nomidan 2 harfli abbreviatura: birinchi harf + oxirgi harf.
 * "Banner" → "BR", "Vizitka" → "VA", "Bayroq" → "BQ", "X" → "XX"
 * Bo'sh/yaroqsiz qiymatlarda null qaytaradi (caller fallback uchun).
 */
export function serviceAbbrev(serviceName: string | null | undefined): string | null {
  if (!serviceName) return null;
  const letters = serviceName.replace(/[^A-Za-zА-Яа-яЁёЎўҚқҒғҲҳ]/g, '');
  if (!letters) return null;
  if (letters.length === 1) return (letters + letters).toUpperCase();
  return (letters[0] + letters[letters.length - 1]).toUpperCase();
}

/**
 * Builds a sequential display ID using tenant abbreviation.
 * Format: VP-10001, SR-10002, etc.
 * Eski API — yangi kod uchun buildDisplayIdFromService'ni ishlating.
 */
export function buildDisplayId(tenantName: string, sequence: number): string {
  const prefix = tenantAbbrev(tenantName);
  return `${prefix}-${10001 + sequence}`;
}

/**
 * Builds a sequential display ID from a service name.
 * Falls back to tenant abbreviation if service name is missing/invalid.
 * Format: BR-10001 (Banner), VA-10002 (Vizitka), ...
 */
export function buildDisplayIdFromService(
  serviceName: string | null | undefined,
  fallbackTenantName: string,
  sequence: number,
): string {
  const prefix = serviceAbbrev(serviceName) ?? tenantAbbrev(fallbackTenantName);
  return `${prefix}-${10001 + sequence}`;
}

/**
 * Extracts the numeric sequence from any displayId format.
 * Handles "ID10001", "VP-10001", "BR-10001".
 */
export function parseDisplayIdSequence(displayId: string): number {
  if (!displayId) return 10000;
  const match = displayId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 10000;
}
