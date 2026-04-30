// Simple in-memory rate limiter for serverless (Vercel Node.js runtime)
// Not perfect (resets on cold start) but good enough to stop brute-force
// NOTE: This file must NOT be imported in Edge Runtime (middleware.ts)

const attempts = new Map<string, { count: number; resetTime: number }>()

const WINDOW_MS = 60_000 // 1 minute window
const MAX_ATTEMPTS = 10  // max attempts per window

export function rateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = attempts.get(key)

  // Lazy cleanup: remove expired entries on each call
  if (attempts.size > 1000) {
    for (const [k, e] of attempts) {
      if (now > e.resetTime) attempts.delete(k)
    }
  }

  if (!entry || now > entry.resetTime) {
    attempts.set(key, { count: 1, resetTime: now + WINDOW_MS })
    return { allowed: true, retryAfterMs: 0 }
  }

  entry.count++
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfterMs = entry.resetTime - now
    return { allowed: false, retryAfterMs }
  }

  return { allowed: true, retryAfterMs: 0 }
}
