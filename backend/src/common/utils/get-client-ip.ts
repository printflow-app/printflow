import { Request } from 'express';

/**
 * Extract the real client IP from an Express request.
 *
 * Behind Railway / Nginx the X-Forwarded-For header contains a
 * comma-separated list: "real-client, proxy1, proxy2, ...".
 * The first entry is always the original client.
 *
 * We also guard against Express giving us an array when multiple
 * XFF headers are present (RFC 7230 §3.2.2 allows header folding).
 */
export function getClientIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];

  let candidate: string | null = null;

  if (xff) {
    const raw = Array.isArray(xff) ? xff[0] : xff;
    const first = raw.split(',')[0].trim();
    if (first) candidate = first;
  }

  if (!candidate) {
    candidate =
      req.ip ||
      (req.socket as any)?.remoteAddress ||
      null;
  }

  if (!candidate) return null;

  // Strip IPv6-mapped IPv4 prefix (::ffff:192.168.1.1 → 192.168.1.1)
  return candidate.startsWith('::ffff:') ? candidate.slice(7) : candidate;
}
