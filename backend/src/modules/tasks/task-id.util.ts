/**
 * Builds a sequential display ID for a task.
 * Format: ID{sequence}  e.g. ID10001, ID10002, ID12271
 * @param existingCount Total tasks created BEFORE this one in the same tenant.
 *                      Pass (baseCount + loopIndex) inside a bulk loop.
 */
export function buildDisplayId(_customerName: string, existingCount: number): string {
  const sequence = 10001 + existingCount;
  return `ID${sequence}`;
}
