// Brute-force guard for POST /auth/login. In-memory (single free Render
// instance), so it resets on restart — good enough to stop password guessing.
//
// Two layers:
//  • per client key (IP): MAX_PER_KEY failures in WINDOW_MS → that key is blocked
//  • global: MAX_GLOBAL failures in WINDOW_MS → everyone is blocked for the rest
//    of the window. This still holds if an attacker rotates IPs or spoofs
//    X-Forwarded-For, since all failures count toward it.
// A successful login clears that key's counter.

export const WINDOW_MS = 15 * 60 * 1000;
export const MAX_PER_KEY = 8;
export const MAX_GLOBAL = 40;

interface Bucket { count: number; resetAt: number }

export interface LimiterOptions {
  windowMs?: number;
  maxPerKey?: number;
  maxGlobal?: number;
}

export function createLoginLimiter(
  now: () => number = Date.now,
  { windowMs = WINDOW_MS, maxPerKey = MAX_PER_KEY, maxGlobal = MAX_GLOBAL }: LimiterOptions = {},
) {
  const perKey = new Map<string, Bucket>();
  let global: Bucket = { count: 0, resetAt: 0 };

  const fresh = (b: Bucket | undefined): Bucket =>
    !b || b.resetAt <= now() ? { count: 0, resetAt: now() + windowMs } : b;

  return {
    /** Seconds until the caller may retry, or 0 if allowed. */
    retryAfter(key: string): number {
      global = fresh(global);
      const b = fresh(perKey.get(key));
      const until =
        global.count >= maxGlobal ? global.resetAt
        : b.count >= maxPerKey ? b.resetAt
        : 0;
      return until ? Math.max(1, Math.ceil((until - now()) / 1000)) : 0;
    },
    recordFailure(key: string): void {
      global = fresh(global);
      global.count++;
      const b = fresh(perKey.get(key));
      b.count++;
      perKey.set(key, b);
      if (perKey.size > 5000) {
        for (const [k, v] of perKey) if (v.resetAt <= now()) perKey.delete(k);
      }
    },
    recordSuccess(key: string): void {
      perKey.delete(key);
    },
  };
}

export const loginLimiter = createLoginLimiter();

// Anonymous POST /public/chat/start writes a DB row per call: cap it.
export const publicChatLimiter = createLoginLimiter(Date.now, {
  windowMs: 60 * 60 * 1000,
  maxPerKey: 10,
  maxGlobal: 200,
});
