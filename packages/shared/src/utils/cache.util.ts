import { Redis } from '@upstash/redis';

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

export async function getCached<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  if (!redis) {
    // No cache available, call factory directly
    return factory();
  }

  try {
    const cached = await redis.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const fresh = await factory();
    await redis.setex(key, ttlSeconds, fresh);
    return fresh;
  } catch (error) {
    console.warn(`Cache operation failed for key ${key}:`, error);
    return factory();
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  if (!redis) return;

  try {
    await redis.setex(key, ttlSeconds, value);
  } catch (error) {
    console.warn(`Cache set failed for key ${key}:`, error);
  }
}

export async function delCache(key: string): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(key);
  } catch (error) {
    console.warn(`Cache delete failed for key ${key}:`, error);
  }
}
