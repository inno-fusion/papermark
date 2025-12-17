import { rateLimit, isRedisConfigured } from "@/lib/redis";

/**
 * Rate limiter configurations
 * Uses unified Redis client (supports ioredis and Upstash)
 */
export const rateLimiterConfigs = {
  // 10 auth attempts per 20 minutes per IP
  auth: {
    limit: 10,
    windowSeconds: 20 * 60, // 20 minutes
    prefix: "rl:auth",
  },
  // 10 billing operations per 20 minutes per IP
  billing: {
    limit: 10,
    windowSeconds: 20 * 60, // 20 minutes
    prefix: "rl:billing",
  },
} as const;

export type RateLimiterType = keyof typeof rateLimiterConfigs;

/**
 * Apply rate limiting with error handling
 */
export async function checkRateLimit(
  limiterType: RateLimiterType,
  identifier: string,
): Promise<{ success: boolean; remaining?: number; reset?: number; error?: string }> {
  // If Redis is not configured, allow all requests
  if (!isRedisConfigured()) {
    return { success: true, error: "Rate limiting unavailable (Redis not configured)" };
  }

  const config = rateLimiterConfigs[limiterType];
  const key = `${config.prefix}:${identifier}`;

  try {
    const result = await rateLimit(key, config.limit, config.windowSeconds);
    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    console.error("Rate limiting error:", error);
    // Fail open - allow request if rate limiting fails
    return { success: true, error: "Rate limiting unavailable" };
  }
}
