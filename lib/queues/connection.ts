import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Create a new connection for each use case (required for BullMQ workers)
export function createRedisConnection() {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
  });
}

// Shared connection for queue operations (adding jobs)
let sharedConnection: Redis | null = null;

export function getRedisConnection() {
  if (!sharedConnection) {
    sharedConnection = createRedisConnection();

    sharedConnection.on("connect", () => {
      console.log("[Redis] Connected to", REDIS_URL);
    });

    sharedConnection.on("error", (err) => {
      console.error("[Redis] Connection error:", err);
    });
  }
  return sharedConnection;
}

// Graceful shutdown
export async function closeRedisConnection() {
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}
