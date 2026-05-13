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
 * Builds a sequential display ID using tenant abbreviation.
 * Format: VP-10001, SR-10002, etc.
 */
export function buildDisplayId(tenantName: string, sequence: number): string {
  const prefix = tenantAbbrev(tenantName);
  return `${prefix}-${10001 + sequence}`;
}

/**
 * Extracts the numeric sequence from any displayId format.
 * Handles both old "ID10001" and new "VP-10001" formats.
 */
export function parseDisplayIdSequence(displayId: string): number {
  if (!displayId) return 10000;
  const match = displayId.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 10000;
}
