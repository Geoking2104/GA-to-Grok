import { Redis } from "ioredis";

let redis: Redis | null = null;
let isConnected = false;

/**
 * Initialize Redis client if REDIS_URL is set.
 * Completely optional — the server works fine without it.
 */
export function initRedis(): void {
  const url = process.env.REDIS_URL;
  if (!url) {
    console.error("[cache] REDIS_URL not set — caching disabled");
    return;
  }

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redis.on("connect", () => {
      isConnected = true;
      console.error("[cache] Redis connected");
    });

    redis.on("error", (err: any) => {
      isConnected = false;
      console.error("[cache] Redis error:", err.message);
    });

    redis.on("close", () => {
      isConnected = false;
      console.error("[cache] Redis connection closed");
    });

    // Connect in background
    redis.connect().catch((err: any) => {
      console.error("[cache] Failed to connect to Redis:", err.message);
      redis = null;
    });
  } catch (err: any) {
    console.error("[cache] Redis init failed:", err.message);
    redis = null;
  }
}

export function isCacheEnabled(): boolean {
  return !!redis && isConnected;
}

/**
 * Generate a stable cache key from a prefix + object.
 */
export function cacheKey(prefix: string, data: Record<string, any>): string {
  const sorted = Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      const val = data[key];
      if (val !== undefined && val !== null) {
        acc[key] = Array.isArray(val) ? val.slice().sort() : val;
      }
      return acc;
    }, {} as Record<string, any>);

  return `ga4:${prefix}:${JSON.stringify(sorted)}`;
}

/**
 * Get a value from cache.
 */
export async function cacheGet<T = any>(key: string): Promise<T | null> {
  if (!isCacheEnabled() || !redis) return null;

  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err: any) {
    console.error("[cache] GET error:", err.message);
    return null;
  }
}

/**
 * Set a value in cache with TTL (seconds).
 */
export async function cacheSet(
  key: string,
  value: any,
  ttlSeconds: number
): Promise<void> {
  if (!isCacheEnabled() || !redis) return;

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err: any) {
    console.error("[cache] SET error:", err.message);
  }
}

/**
 * Delete keys matching a pattern (use carefully).
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  if (!isCacheEnabled() || !redis) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch (err: any) {
    console.error("[cache] DEL pattern error:", err.message);
  }
}

// Default TTLs (can be overridden by env)
export const TTL = {
  report: parseInt(process.env.CACHE_TTL_REPORT || "600", 10), // 10 min
  metadata: parseInt(process.env.CACHE_TTL_METADATA || "3600", 10), // 1 hour
  properties: parseInt(process.env.CACHE_TTL_PROPERTIES || "1800", 10), // 30 min
  realtime: 0, // never cache realtime
};
