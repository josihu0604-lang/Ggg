import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

// 10/10s(anon), 100/10s(user) — graceful degradation if Redis unavailable
const anonLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '10 s') })
  : null;
const userLimiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '10 s') })
  : null;

export async function middleware(req: NextRequest) {
  // Security headers
  const res = NextResponse.next();
  res.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  );
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Rate limiting only on API routes
  if (!req.nextUrl.pathname.startsWith('/api/')) return res;

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                   req.headers.get('x-real-ip') || 
                   'unknown';
  const uid = req.headers.get('x-user-id') || clientIp || 'anon';
  const limiter = uid === 'anon' ? anonLimiter : userLimiter;

  if (!limiter) return res; // Redis not configured, skip rate limiting

  const { success, remaining } = await limiter.limit(uid);
  if (!success) {
    return NextResponse.json({ error: 'rate_limit' }, { status: 429 });
  }

  res.headers.set('X-RateLimit-Remaining', String(remaining));
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
