import Redis from "ioredis";

// ===========================================
// REDIS CONFIGURATION
// ===========================================

/**
 * Unified Redis client that supports:
 * - Standard Redis via ioredis (recommended for self-hosting)
 * - Upstash REST API (for serverless/Vercel deployments)
 *
 * Priority:
 * 1. REDIS_URL (standard Redis - for self-hosting)
 * 2. UPSTASH_REDIS_REST_URL (Upstash REST - for serverless)
 */

type RedisProvider = "ioredis" | "upstash" | "none";

function getRedisProvider(): RedisProvider {
  if (process.env.REDIS_URL) {
    return "ioredis";
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return "upstash";
  }
  return "none";
}

export function isRedisConfigured(): boolean {
  return getRedisProvider() !== "none";
}

export function getRedisProviderName(): string {
  const provider = getRedisProvider();
  return provider === "none" ? "NOT CONFIGURED" : provider.toUpperCase();
}

// ===========================================
// IOREDIS CLIENT (Standard Redis)
// ===========================================

let ioredisClient: Redis | null = null;

function getIoRedisClient(): Redis {
  if (!ioredisClient) {
    const url = process.env.REDIS_URL || "redis://localhost:6379";
    ioredisClient = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    });

    ioredisClient.on("error", (err) => {
      console.error("[Redis] Connection error:", err.message);
    });
  }
  return ioredisClient;
}

// ===========================================
// UPSTASH CLIENT (REST API)
// ===========================================

let upstashClient: any = null;

async function getUpstashClient() {
  if (upstashClient) {
    return upstashClient;
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  // Dynamic import to avoid loading Upstash if not needed
  const { Redis: UpstashRedis } = await import("@upstash/redis");
  upstashClient = new UpstashRedis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return upstashClient;
}

// ===========================================
// UNIFIED REDIS INTERFACE
// ===========================================

export interface UnifiedRedis {
  get<T = string>(key: string): Promise<T | null>;
  set(key: string, value: string | number, options?: { ex?: number; px?: number; pxat?: number; exat?: number; nx?: boolean }): Promise<any>;
  setex(key: string, seconds: number, value: string | number): Promise<any>;
  del(key: string | string[]): Promise<number>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
  exists(key: string | string[]): Promise<number>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string | Record<string, string | number>, value?: string | number): Promise<number>;
  hincrby(key: string, field: string, increment: number): Promise<number>;
  hdel(key: string, field: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  smembers(key: string): Promise<string[]>;
  sismember(key: string, member: string): Promise<number>;
  lpush(key: string, ...values: string[]): Promise<number>;
  rpush(key: string, ...values: string[]): Promise<number>;
  lpop(key: string): Promise<string | null>;
  rpop(key: string): Promise<string | null>;
  lrange(key: string, start: number, stop: number): Promise<string[]>;
  zadd(key: string, scoreMembers: { score: number; member: string } | { score: number; member: string }[]): Promise<number>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zrange(key: string, start: number, stop: number, options?: { byScore?: boolean; rev?: boolean }): Promise<string[]>;
  zrangebyscore(key: string, min: number | string, max: number | string): Promise<string[]>;
  zrevrange(key: string, start: number, stop: number): Promise<string[]>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: number, options?: { match?: string; count?: number }): Promise<[string, string[]]>;
}

// Track if we've logged the warning
let hasLoggedNotConfigured = false;

/**
 * Create a unified Redis client wrapper
 */
function createUnifiedRedis(): UnifiedRedis {
  const provider = getRedisProvider();

  if (provider === "none") {
    // Return a no-op client that logs warning once
    return createNoOpRedis();
  }

  if (provider === "ioredis") {
    return createIoRedisWrapper();
  }

  // Upstash - return async wrapper
  return createUpstashWrapper();
}

function createNoOpRedis(): UnifiedRedis {
  const logWarning = () => {
    if (!hasLoggedNotConfigured) {
      console.warn(
        "[Redis] Redis not configured. Set REDIS_URL or UPSTASH_REDIS_REST_URL/TOKEN to enable Redis features.",
      );
      hasLoggedNotConfigured = true;
    }
  };

  return {
    get: async () => { logWarning(); return null; },
    set: async () => { logWarning(); return "OK"; },
    setex: async () => { logWarning(); return "OK"; },
    del: async () => { logWarning(); return 0; },
    incr: async () => { logWarning(); return 0; },
    expire: async () => { logWarning(); return 0; },
    ttl: async () => { logWarning(); return -2; },
    exists: async () => { logWarning(); return 0; },
    hget: async () => { logWarning(); return null; },
    hset: async () => { logWarning(); return 0; },
    hincrby: async () => { logWarning(); return 0; },
    hdel: async () => { logWarning(); return 0; },
    hgetall: async () => { logWarning(); return {}; },
    sadd: async () => { logWarning(); return 0; },
    srem: async () => { logWarning(); return 0; },
    smembers: async () => { logWarning(); return []; },
    sismember: async () => { logWarning(); return 0; },
    lpush: async () => { logWarning(); return 0; },
    rpush: async () => { logWarning(); return 0; },
    lpop: async () => { logWarning(); return null; },
    rpop: async () => { logWarning(); return null; },
    lrange: async () => { logWarning(); return []; },
    zadd: async () => { logWarning(); return 0; },
    zrem: async () => { logWarning(); return 0; },
    zrange: async () => { logWarning(); return []; },
    zrangebyscore: async () => { logWarning(); return []; },
    zrevrange: async () => { logWarning(); return []; },
    keys: async () => { logWarning(); return []; },
    scan: async () => { logWarning(); return ["0", []]; },
  };
}

function createIoRedisWrapper(): UnifiedRedis {
  const client = getIoRedisClient();

  return {
    get: async <T = string>(key: string) => {
      const value = await client.get(key);
      if (value === null) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    },
    set: async (key, value, options) => {
      const args: [string, string | number, ...Array<string | number>] = [key, typeof value === "object" ? JSON.stringify(value) : value];
      if (options?.ex) args.push("EX", options.ex);
      if (options?.px) args.push("PX", options.px);
      if (options?.pxat) args.push("PXAT", options.pxat);
      if (options?.exat) args.push("EXAT", options.exat);
      if (options?.nx) args.push("NX");
      return (client.set as Function).apply(client, args);
    },
    setex: (key, seconds, value) => client.setex(key, seconds, typeof value === "object" ? JSON.stringify(value) : String(value)),
    del: (key) => client.del(key as any),
    incr: (key) => client.incr(key),
    expire: (key, seconds) => client.expire(key, seconds),
    ttl: (key) => client.ttl(key),
    exists: (key) => client.exists(key as any),
    hget: (key, field) => client.hget(key, field),
    hset: async (key, field, value) => {
      if (typeof field === "object") {
        // Handle object form: hset(key, { field1: value1, field2: value2 })
        const entries = Object.entries(field).flat();
        return client.hset(key, ...entries);
      }
      // Handle standard form: hset(key, field, value)
      return client.hset(key, field, String(value));
    },
    hincrby: (key, field, increment) => client.hincrby(key, field, increment),
    hdel: (key, field) => client.hdel(key, field),
    hgetall: (key) => client.hgetall(key),
    sadd: (key, ...members) => client.sadd(key, ...members),
    srem: (key, ...members) => client.srem(key, ...members),
    smembers: (key) => client.smembers(key),
    sismember: (key, member) => client.sismember(key, member),
    lpush: (key, ...values) => client.lpush(key, ...values),
    rpush: (key, ...values) => client.rpush(key, ...values),
    lpop: (key) => client.lpop(key),
    rpop: (key) => client.rpop(key),
    lrange: (key, start, stop) => client.lrange(key, start, stop),
    zadd: async (key, scoreMembers) => {
      const items = Array.isArray(scoreMembers) ? scoreMembers : [scoreMembers];
      const args: (string | number)[] = [];
      for (const item of items) {
        args.push(item.score, item.member);
      }
      return client.zadd(key, ...args);
    },
    zrem: (key, ...members) => client.zrem(key, ...members),
    zrange: async (key, start, stop, options) => {
      if (options?.byScore) {
        return client.zrangebyscore(key, start, stop);
      }
      if (options?.rev) {
        return client.zrevrange(key, start, stop);
      }
      return client.zrange(key, start, stop);
    },
    zrangebyscore: (key, min, max) => client.zrangebyscore(key, min, max),
    zrevrange: (key, start, stop) => client.zrevrange(key, start, stop),
    keys: (pattern) => client.keys(pattern),
    scan: async (cursor, options) => {
      const args: [number, ...Array<string | number>] = [cursor];
      if (options?.match) args.push("MATCH", options.match);
      if (options?.count) args.push("COUNT", options.count);
      const result = await (client.scan as Function).apply(client, args);
      return [result[0], result[1]];
    },
  };
}

function createUpstashWrapper(): UnifiedRedis {
  // Upstash client is loaded lazily
  return {
    get: async <T = string>(key: string) => {
      const client = await getUpstashClient();
      if (!client) return null;
      return client.get(key) as Promise<T | null>;
    },
    set: async (key, value, options) => {
      const client = await getUpstashClient();
      if (!client) return "OK";
      return client.set(key, value, options);
    },
    setex: async (key, seconds, value) => {
      const client = await getUpstashClient();
      if (!client) return "OK";
      return client.setex(key, seconds, value);
    },
    del: async (key) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.del(key);
    },
    incr: async (key) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.incr(key);
    },
    expire: async (key, seconds) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.expire(key, seconds);
    },
    ttl: async (key) => {
      const client = await getUpstashClient();
      if (!client) return -2;
      return client.ttl(key);
    },
    exists: async (key) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.exists(key);
    },
    hget: async (key, field) => {
      const client = await getUpstashClient();
      if (!client) return null;
      return client.hget(key, field);
    },
    hset: async (key, field, value) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      if (typeof field === "object") {
        // Handle object form: hset(key, { field1: value1, field2: value2 })
        return client.hset(key, field as Record<string, string | number>);
      }
      // Handle standard form: hset(key, field, value)
      return client.hset(key, { [field]: value });
    },
    hincrby: async (key, field, increment) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.hincrby(key, field, increment);
    },
    hdel: async (key, field) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.hdel(key, field);
    },
    hgetall: async (key) => {
      const client = await getUpstashClient();
      if (!client) return {};
      return client.hgetall(key) || {};
    },
    sadd: async (key, ...members) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.sadd(key, ...members);
    },
    srem: async (key, ...members) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.srem(key, ...members);
    },
    smembers: async (key) => {
      const client = await getUpstashClient();
      if (!client) return [];
      return client.smembers(key);
    },
    sismember: async (key, member) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.sismember(key, member);
    },
    lpush: async (key, ...values) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.lpush(key, ...values);
    },
    rpush: async (key, ...values) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.rpush(key, ...values);
    },
    lpop: async (key) => {
      const client = await getUpstashClient();
      if (!client) return null;
      return client.lpop(key);
    },
    rpop: async (key) => {
      const client = await getUpstashClient();
      if (!client) return null;
      return client.rpop(key);
    },
    lrange: async (key, start, stop) => {
      const client = await getUpstashClient();
      if (!client) return [];
      return client.lrange(key, start, stop);
    },
    zadd: async (key, scoreMembers) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      const items = Array.isArray(scoreMembers) ? scoreMembers : [scoreMembers];
      // Upstash zadd expects { score, member } objects
      return client.zadd(key, ...items);
    },
    zrem: async (key, ...members) => {
      const client = await getUpstashClient();
      if (!client) return 0;
      return client.zrem(key, ...members);
    },
    zrange: async (key, start, stop, options) => {
      const client = await getUpstashClient();
      if (!client) return [];
      if (options?.byScore) {
        return client.zrange(key, start, stop, { byScore: true });
      }
      if (options?.rev) {
        return client.zrange(key, start, stop, { rev: true });
      }
      return client.zrange(key, start, stop);
    },
    zrangebyscore: async (key, min, max) => {
      const client = await getUpstashClient();
      if (!client) return [];
      // Use zrange with byScore option in Upstash
      return client.zrange(key, min, max, { byScore: true });
    },
    zrevrange: async (key, start, stop) => {
      const client = await getUpstashClient();
      if (!client) return [];
      return client.zrevrange(key, start, stop);
    },
    keys: async (pattern) => {
      const client = await getUpstashClient();
      if (!client) return [];
      return client.keys(pattern);
    },
    scan: async (cursor, options) => {
      const client = await getUpstashClient();
      if (!client) return ["0", []];
      return client.scan(cursor, options);
    },
  };
}

// ===========================================
// EXPORTED REDIS CLIENT
// ===========================================

/**
 * Unified Redis client
 * Works with both standard Redis (ioredis) and Upstash REST API
 */
export const redis = createUnifiedRedis();

/**
 * Get raw ioredis client (for BullMQ compatibility or direct access)
 * Returns null if using Upstash or not configured
 */
export function getRawIoRedisClient(): Redis | null {
  if (getRedisProvider() === "ioredis") {
    return getIoRedisClient();
  }
  return null;
}

// ===========================================
// LOCKER REDIS (for TUS uploads)
// ===========================================

let lockerIoRedisClient: Redis | null = null;

/**
 * Get Redis client for TUS file upload locking
 * Uses separate connection/config for isolation
 */
export function getLockerRedisClient(): Redis | null {
  const provider = getRedisProvider();

  if (provider === "ioredis") {
    if (!lockerIoRedisClient) {
      const url = process.env.REDIS_URL || "redis://localhost:6379";
      lockerIoRedisClient = new Redis(url, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        lazyConnect: true,
      });
    }
    return lockerIoRedisClient;
  }

  // For Upstash locker, return null - TUS locker needs different implementation
  return null;
}

// Legacy export for backwards compatibility with code using lockerRedisClient
// This will be deprecated
export const lockerRedisClient = {
  async get(key: string) {
    const client = getLockerRedisClient();
    if (client) return client.get(key);
    // Fall back to Upstash if available
    if (process.env.UPSTASH_REDIS_REST_LOCKER_URL) {
      const { Redis: UpstashRedis } = await import("@upstash/redis");
      const upstash = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_LOCKER_URL,
        token: process.env.UPSTASH_REDIS_REST_LOCKER_TOKEN!,
      });
      return upstash.get(key);
    }
    return null;
  },
  async set(key: string, value: any, options?: { px?: number; nx?: boolean }) {
    const client = getLockerRedisClient();
    if (client) {
      const args: any[] = [key, value];
      if (options?.px) args.push("PX", options.px);
      if (options?.nx) args.push("NX");
      return (client.set as Function).apply(client, args);
    }
    if (process.env.UPSTASH_REDIS_REST_LOCKER_URL) {
      const { Redis: UpstashRedis } = await import("@upstash/redis");
      const upstash = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_LOCKER_URL,
        token: process.env.UPSTASH_REDIS_REST_LOCKER_TOKEN!,
      });
      // Cast options to any to avoid strict Upstash type checking
      return upstash.set(key, value, options as any);
    }
    return null;
  },
  async del(key: string) {
    const client = getLockerRedisClient();
    if (client) return client.del(key);
    if (process.env.UPSTASH_REDIS_REST_LOCKER_URL) {
      const { Redis: UpstashRedis } = await import("@upstash/redis");
      const upstash = new UpstashRedis({
        url: process.env.UPSTASH_REDIS_REST_LOCKER_URL,
        token: process.env.UPSTASH_REDIS_REST_LOCKER_TOKEN!,
      });
      return upstash.del(key);
    }
    return 0;
  },
};

// ===========================================
// RATE LIMITING
// ===========================================

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Simple rate limiter using Redis
 * Works with both ioredis and Upstash
 */
export async function rateLimit(
  identifier: string,
  limit: number = 10,
  windowSeconds: number = 60,
): Promise<RateLimitResult> {
  const key = `ratelimit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;

  try {
    if (getRedisProvider() === "ioredis") {
      const client = getIoRedisClient();

      // Use sorted set for sliding window
      const multi = client.multi();
      multi.zremrangebyscore(key, 0, windowStart);
      multi.zadd(key, now, `${now}-${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, windowSeconds);

      const results = await multi.exec();
      const count = results?.[2]?.[1] as number || 0;

      return {
        success: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        reset: now + windowSeconds,
      };
    } else if (getRedisProvider() === "upstash") {
      // For Upstash, use the @upstash/ratelimit if available
      // Otherwise fall back to simple counter
      const client = await getUpstashClient();
      if (!client) {
        return { success: true, limit, remaining: limit, reset: now + windowSeconds };
      }

      // Simple counter-based rate limiting for Upstash
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, windowSeconds);
      }

      return {
        success: count <= limit,
        limit,
        remaining: Math.max(0, limit - count),
        reset: now + windowSeconds,
      };
    }

    // No Redis configured - allow all requests
    return { success: true, limit, remaining: limit, reset: now + windowSeconds };
  } catch (error) {
    console.warn("[RateLimit] Error:", error);
    // Fail open - allow request if rate limiting fails
    return { success: true, limit, remaining: limit, reset: now + windowSeconds };
  }
}

/**
 * Legacy ratelimit function for backwards compatibility
 * @deprecated Use rateLimit() instead
 */
export const ratelimit = (
  requests: number = 10,
  seconds:
    | `${number} ms`
    | `${number} s`
    | `${number} m`
    | `${number} h`
    | `${number} d` = "10 s",
) => {
  // Parse the duration string
  const match = seconds.match(/^(\d+)\s*(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration format: ${seconds}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  let windowSeconds: number;
  switch (unit) {
    case "ms":
      windowSeconds = Math.ceil(value / 1000);
      break;
    case "s":
      windowSeconds = value;
      break;
    case "m":
      windowSeconds = value * 60;
      break;
    case "h":
      windowSeconds = value * 60 * 60;
      break;
    case "d":
      windowSeconds = value * 60 * 60 * 24;
      break;
    default:
      windowSeconds = 10;
  }

  return {
    limit: async (identifier: string) => {
      return rateLimit(identifier, requests, windowSeconds);
    },
  };
};
