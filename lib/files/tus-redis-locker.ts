import { ERRORS, Lock, Locker, RequestRelease } from "@tus/utils";
import type Redis from "ioredis";

import { getLockerRedisClient, isRedisConfigured } from "@/lib/redis";

/**
 * RedisLocker is an implementation of the Locker interface that manages locks in key-value store using Redis.
 * This class is designed for exclusive access control over resources, often used in scenarios like upload management.
 *
 * Key Features:
 * - Ensures exclusive resource access by using a KV-based map to track locks.
 * - Implements timeout for lock acquisition, mitigating deadlock situations.
 * - Facilitates both immediate and graceful release of locks through different mechanisms.
 *
 * Locking Behavior:
 * - When the `lock` method is invoked for an already locked resource, the `cancelReq` callback is called.
 *   This signals to the current lock holder that another process is requesting the lock, encouraging them to release it as soon as possible.
 * - The lock attempt continues until the specified timeout is reached. If the timeout expires and the lock is still not
 *   available, an error is thrown to indicate lock acquisition failure.
 *
 * Lock Acquisition and Release:
 * - The `lock` method implements a wait mechanism, allowing a lock request to either succeed when the lock becomes available,
 *   or fail after the timeout period.
 * - The `unlock` method releases a lock, making the resource available for other requests.
 *
 * Note: This locker supports both ioredis (standard Redis) and Upstash REST API.
 * When using ioredis, it provides full locking functionality.
 * When Redis is not configured, it uses in-memory locking (single-process only).
 */

interface RedisLockerOptions {
  acquireLockTimeout?: number;
}

// In-memory lock store for when Redis is not available
const inMemoryLocks = new Map<string, { locked: boolean; requestRelease: boolean }>();

export class RedisLocker implements Locker {
  timeout: number;
  private redisClient: Redis | null;

  constructor(options: RedisLockerOptions = {}) {
    this.timeout = options.acquireLockTimeout ?? 1000 * 30; // default: 30 seconds
    this.redisClient = getLockerRedisClient();

    if (!this.redisClient && isRedisConfigured()) {
      console.warn(
        "[TUS Locker] Redis is configured but locker client unavailable. Using in-memory locking.",
      );
    } else if (!this.redisClient) {
      console.warn(
        "[TUS Locker] Redis not configured. Using in-memory locking (single-process only).",
      );
    }
  }

  newLock(id: string) {
    if (this.redisClient) {
      return new IoRedisLock(id, this.redisClient, this.timeout);
    }
    return new InMemoryLock(id, this.timeout);
  }
}

/**
 * Redis-based lock using ioredis
 */
class IoRedisLock implements Lock {
  constructor(
    private id: string,
    private redisClient: Redis,
    private timeout: number = 1000 * 30,
  ) {}

  async lock(
    signal: AbortSignal,
    requestRelease: RequestRelease,
  ): Promise<void> {
    const abortController = new AbortController();
    const lock = await Promise.race([
      this.waitTimeout(signal),
      this.acquireLock(this.id, requestRelease, signal),
    ]);

    abortController.abort();

    if (!lock) {
      throw ERRORS.ERR_LOCK_TIMEOUT;
    }
  }

  protected async acquireLock(
    id: string,
    requestRelease: RequestRelease,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (signal.aborted) {
      return false;
    }

    const lockKey = `tus-lock-${id}`;
    // Use SET with NX and PX options for atomic lock acquisition
    const lock = await this.redisClient.set(
      lockKey,
      "locked",
      "PX",
      this.timeout,
      "NX",
    );

    if (lock === "OK") {
      // Register a release request flag in Redis
      await this.redisClient.set(
        `requestRelease:${lockKey}`,
        "true",
        "PX",
        this.timeout,
      );
      return true;
    }

    // Check if the release was requested
    const releaseRequestStr = await this.redisClient.get(
      `requestRelease:${lockKey}`,
    );
    if (releaseRequestStr === "true") {
      await requestRelease?.();
    }

    await new Promise((resolve, reject) => {
      setImmediate(() => {
        this.acquireLock(id, requestRelease, signal)
          .then(resolve)
          .catch(reject);
      });
    });

    return false;
  }

  async unlock(): Promise<void> {
    const lockKey = `tus-lock-${this.id}`;
    const lockExists = await this.redisClient.del(lockKey);
    if (!lockExists) {
      throw new Error("Releasing an unlocked lock!");
    }

    // Clean up the request release entry
    await this.redisClient.del(`requestRelease:${lockKey}`);
  }

  protected waitTimeout(signal: AbortSignal) {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, this.timeout);

      const abortListener = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abortListener);
        resolve(false);
      };
      signal.addEventListener("abort", abortListener);
    });
  }
}

/**
 * In-memory lock for single-process deployments without Redis
 */
class InMemoryLock implements Lock {
  constructor(
    private id: string,
    private timeout: number = 1000 * 30,
  ) {}

  async lock(
    signal: AbortSignal,
    requestRelease: RequestRelease,
  ): Promise<void> {
    const lock = await Promise.race([
      this.waitTimeout(signal),
      this.acquireLock(this.id, requestRelease, signal),
    ]);

    if (!lock) {
      throw ERRORS.ERR_LOCK_TIMEOUT;
    }
  }

  protected async acquireLock(
    id: string,
    requestRelease: RequestRelease,
    signal: AbortSignal,
  ): Promise<boolean> {
    if (signal.aborted) {
      return false;
    }

    const lockKey = `tus-lock-${id}`;
    const existing = inMemoryLocks.get(lockKey);

    if (!existing || !existing.locked) {
      // Acquire lock
      inMemoryLocks.set(lockKey, { locked: true, requestRelease: true });

      // Auto-expire the lock after timeout
      setTimeout(() => {
        const current = inMemoryLocks.get(lockKey);
        if (current?.locked) {
          inMemoryLocks.delete(lockKey);
        }
      }, this.timeout);

      return true;
    }

    // Lock exists, check if release was requested
    if (existing.requestRelease) {
      await requestRelease?.();
    }

    // Wait and retry
    await new Promise((resolve) => setImmediate(resolve));
    return this.acquireLock(id, requestRelease, signal);
  }

  async unlock(): Promise<void> {
    const lockKey = `tus-lock-${this.id}`;
    const existing = inMemoryLocks.get(lockKey);

    if (!existing || !existing.locked) {
      throw new Error("Releasing an unlocked lock!");
    }

    inMemoryLocks.delete(lockKey);
  }

  protected waitTimeout(signal: AbortSignal) {
    return new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, this.timeout);

      const abortListener = () => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abortListener);
        resolve(false);
      };
      signal.addEventListener("abort", abortListener);
    });
  }
}
