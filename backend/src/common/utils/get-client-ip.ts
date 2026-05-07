import { Request } from 'express';

/**
 * Universal client IP extractor.
 *
 * Checks every common proxy header in priority order so the same code
 * works behind Cloudflare, Nginx, Railway, Vercel, or any standard
 * load balancer. Behind multi-hop proxies the real client is always
 * the FIRST entry in X-Forwarded-For.
 *
 * Priority:
 *   1. cf-connecting-ip   (Cloudflare)
 *   2. x-real-ip          (Nginx / generic proxies)
 *   3. x-forwarded-for    (RFC 7239, comma-separated chain)
 *   4. socket remoteAddress / req.ip   (direct connection fallback)
 */
export function getClientIp(req: Request): string {
  // Helper — strip IPv6-mapped IPv4 prefix and trim
  const clean = (ip: string): string => {
    const t = ip.trim();
    return t.startsWith('::ffff:') ? t.slice(7) : t;
  };

  // 1. Cloudflare
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) {
    const v = Array.isArray(cfIp) ? cfIp[0] : cfIp;
    if (v) return clean(v);
  }

  // 2. Nginx / generic proxy "real" header
  const realIp = req.headers['x-real-ip'];
  if (realIp) {
    const v = Array.isArray(realIp) ? realIp[0] : realIp;
    if (v) return clean(v);
  }

  // 3. X-Forwarded-For (true client = first entry)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const first = raw.split(',')[0];
    if (first && first.trim()) return clean(first);
  }

  // 4. Direct socket fallback
  const fallback = req.socket?.remoteAddress || req.ip;
  if (fallback) return clean(fallback);

  return 'Unknown IP';
}
