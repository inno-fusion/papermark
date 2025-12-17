import Bottleneck from "bottleneck";

// Rate limiter for emails (to avoid hitting Resend's rate limit of 10 req/s)
export const limiter = new Bottleneck({
  maxConcurrent: 1, // maximum concurrent requests
  minTime: 100, // minimum time between requests in ms
});

// =============================================================================
// QStash (Optional - only needed when using Vercel + QStash for cron scheduling)
// For self-hosted deployments, cron routes can be triggered by any scheduler
// (system cron, Kubernetes CronJob, etc.) and verification will be skipped.
// =============================================================================

// Lazy-loaded QStash receiver for signature verification
// Only used on Vercel to verify cron requests came from QStash
let _receiver: { verify: (opts: { signature: string; body: string }) => Promise<boolean> } | null = null;

export const receiver = {
  verify: async (opts: { signature: string; body: string }): Promise<boolean> => {
    // If QStash is not configured, allow the request (for self-hosted setups)
    if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
      console.warn("[Cron] QStash not configured, skipping signature verification");
      return true;
    }

    // Lazy-load QStash receiver only when needed
    if (!_receiver) {
      const { Receiver } = await import("@upstash/qstash");
      _receiver = new Receiver({
        currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
        nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
      });
    }

    return _receiver.verify(opts);
  },
};

// QStash client is no longer exported - webhook delivery now uses BullMQ
// For backwards compatibility, we keep a stub that throws if used
export const qstash = {
  publishJSON: async () => {
    throw new Error(
      "QStash is no longer used for webhook delivery. " +
        "Webhooks are now delivered via BullMQ workers. " +
        "See lib/queues/workers/webhook-delivery.worker.ts"
    );
  },
};
