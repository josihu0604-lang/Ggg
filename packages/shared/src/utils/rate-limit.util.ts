// Rate limiting utility using Redis
// Protects against abuse and automated attacks

import Redis from 'ioredis';

// Initialize Redis client (graceful degradation if not available)
let redis: Redis | null = null;

try {
  if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying
        return Math.min(times * 100, 3000); // Exponential backoff
      },
      lazyConnect: true
    });

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err);
      redis = null; // Disable Redis on connection error
    });

    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });
  } else {
    console.warn('[Redis] REDIS_URL not configured, rate limiting disabled');
  }
} catch (error) {
  console.error('[Redis] Initialization error:', error);
  redis = null;
}

export interface RateLimitConfig {
  count: number;   // Max requests allowed
  window: number;  // Time window in seconds
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Check rate limit for a user action
 * Uses Redis for distributed rate limiting
 * Falls back gracefully if Redis is unavailable
 */
export async function checkRateLimit(
  userId: string,
  action: 'checkin' | 'token_redeem' | 'qr_scan' | 'api_call',
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rate_limit:${action}:${userId}`;

  // If Redis is not available, allow (graceful degradation)
  if (!redis) {
    console.warn(`[Rate Limit] Redis unavailable, allowing action: ${action} for user ${userId}`);
    return {
      allowed: true,
      remaining: config.count,
      resetAt: new Date(Date.now() + config.window * 1000),
      limit: config.count
    };
  }

  try {
    // Use Redis INCR + EXPIRE for atomic rate limiting
    const count = await redis.incr(key);

    // Set expiry on first request
    if (count === 1) {
      await redis.expire(key, config.window);
    }

    const allowed = count <= config.count;
    const remaining = Math.max(0, config.count - count);
    const ttl = await redis.ttl(key);
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : config.window * 1000));

    if (!allowed) {
      console.warn('[Rate Limit] Exceeded', {
        userId,
        action,
        count,
        limit: config.count,
        window: config.window,
        resetAt
      });
    }

    return {
      allowed,
      remaining,
      resetAt,
      limit: config.count
    };
  } catch (error) {
    console.error('[Rate Limit] Redis error:', error);
    
    // Graceful degradation: allow on error
    return {
      allowed: true,
      remaining: config.count,
      resetAt: new Date(Date.now() + config.window * 1000),
      limit: config.count
    };
  }
}

/**
 * Predefined rate limit configurations
 */
export const RATE_LIMITS = {
  // Check-in: 50 per day (protects against automated fraud)
  CHECKIN_DAILY: { count: 50, window: 86400 } as RateLimitConfig,
  
  // Check-in: 10 per hour (prevents rapid-fire attempts)
  CHECKIN_HOURLY: { count: 10, window: 3600 } as RateLimitConfig,
  
  // Token redemption: 5 per day (prevents abuse)
  TOKEN_REDEEM_DAILY: { count: 5, window: 86400 } as RateLimitConfig,
  
  // QR scan: 20 per hour (normal usage ceiling)
  QR_SCAN_HOURLY: { count: 20, window: 3600 } as RateLimitConfig,
  
  // API calls: 100 per minute (DDoS protection)
  API_MINUTE: { count: 100, window: 60 } as RateLimitConfig,
  
  // API calls: 1000 per hour
  API_HOURLY: { count: 1000, window: 3600 } as RateLimitConfig
};

/**
 * Check multiple rate limits simultaneously
 * All must pass for the action to be allowed
 */
export async function checkMultipleRateLimits(
  userId: string,
  action: string,
  configs: { name: string; config: RateLimitConfig }[]
): Promise<{
  allowed: boolean;
  failed?: string;
  results: Record<string, RateLimitResult>;
}> {
  const results: Record<string, RateLimitResult> = {};

  for (const { name, config } of configs) {
    const result = await checkRateLimit(userId, action as any, config);
    results[name] = result;

    if (!result.allowed) {
      return {
        allowed: false,
        failed: name,
        results
      };
    }
  }

  return {
    allowed: true,
    results
  };
}

/**
 * Reset rate limit for a user (admin function)
 */
export async function resetRateLimit(
  userId: string,
  action: 'checkin' | 'token_redeem' | 'qr_scan' | 'api_call'
): Promise<void> {
  if (!redis) return;

  const key = `rate_limit:${action}:${userId}`;
  await redis.del(key);

  console.log('[Rate Limit] Reset', { userId, action });
}

/**
 * Get current rate limit status without incrementing
 */
export async function getRateLimitStatus(
  userId: string,
  action: 'checkin' | 'token_redeem' | 'qr_scan' | 'api_call',
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `rate_limit:${action}:${userId}`;

  if (!redis) {
    return {
      allowed: true,
      remaining: config.count,
      resetAt: new Date(Date.now() + config.window * 1000),
      limit: config.count
    };
  }

  try {
    const count = parseInt(await redis.get(key) || '0', 10);
    const ttl = await redis.ttl(key);
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : config.window * 1000));

    return {
      allowed: count < config.count,
      remaining: Math.max(0, config.count - count),
      resetAt,
      limit: config.count
    };
  } catch (error) {
    console.error('[Rate Limit] Status check error:', error);
    return {
      allowed: true,
      remaining: config.count,
      resetAt: new Date(Date.now() + config.window * 1000),
      limit: config.count
    };
  }
}

/**
 * Cleanup: Close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
