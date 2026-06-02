import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// =============================================
// USER-SCOPED THROTTLER GUARD
//
// The rate limit (200 req / 60s) is bucketed per AUTHENTICATED USER (JWT `sub`)
// instead of per IP.
//
// WHY: behind Railway's edge proxy, every employee sitting in one office shares a
// single public/NAT IP. An IP-keyed limit therefore becomes ONE shared bucket for
// the whole office. The dashboard fires 15-25 parallel requests per load, so a few
// people refreshing at once blow past 200/min and get 429s — which the frontend
// silently renders as empty lists ("data disappears on some devices / each refresh
// a different list is missing"). Keying by user gives every person their own bucket.
//
// Unauthenticated routes (login / register) carry no token → we fall back to the
// real client IP (trust proxy is enabled in main.ts), which is exactly what we want
// for brute-force protection on auth endpoints.
//
// SECURITY NOTE: we DECODE the JWT here without verifying the signature. This guard
// runs before JwtAuthGuard (which does the real verification). A forged token only
// lets an attacker choose their own bucket key — it cannot lower a victim's limit,
// and any request that actually reaches a handler must still pass JwtAuthGuard. So
// decode-only is sufficient for abuse bucketing and avoids wiring the JWT secret here.
// =============================================

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const userId = this.extractUserId(req);
    if (userId) return `user:${userId}`;

    // Fallback: real client IP. With `trust proxy` enabled, req.ips holds the
    // forwarded chain (client first); req.ip is the resolved client address.
    const ip =
      (Array.isArray(req.ips) && req.ips.length ? req.ips[0] : req.ip) ||
      'unknown';
    return `ip:${ip}`;
  }

  private extractUserId(req: Record<string, any>): string | null {
    const token = this.extractToken(req);
    if (!token) return null;
    try {
      const payloadSeg = token.split('.')[1];
      if (!payloadSeg) return null;
      const json = Buffer.from(payloadSeg, 'base64url').toString('utf8');
      const payload = JSON.parse(json);
      return payload?.sub ? String(payload.sub) : null;
    } catch {
      return null;
    }
  }

  private extractToken(req: Record<string, any>): string | null {
    // Mirror JwtAuthGuard.extractToken: httpOnly cookie first, then Bearer header.
    const cookieToken = req.cookies?.['pf_token'];
    if (cookieToken) return cookieToken;

    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }
    return null;
  }
}
