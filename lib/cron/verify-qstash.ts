import { receiver } from ".";
import { log } from "../utils";

/**
 * Verify QStash signature for cron endpoints.
 *
 * This verification is only performed on Vercel deployments with QStash.
 * For self-hosted setups, verification is skipped (cron routes can be
 * triggered by any scheduler like system cron, Kubernetes CronJob, etc.)
 */
export const verifyQstashSignature = async ({
  req,
  rawBody,
}: {
  req: Request;
  rawBody: string; // Make sure to pass the raw body not the parsed JSON
}) => {
  // Skip verification in local/self-hosted environments
  if (process.env.VERCEL !== "1") {
    return;
  }

  // Skip verification if QStash is not configured
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
    return;
  }

  const signature = req.headers.get("Upstash-Signature");

  if (!signature) {
    throw new Error("Upstash-Signature header not found.");
  }

  const isValid = await receiver.verify({
    signature,
    body: rawBody,
  });

  if (!isValid) {
    const url = req.url;
    const messageId = req.headers.get("Upstash-Message-Id");

    log({
      message: `Invalid QStash request signature: *${url}* - *${messageId}*`,
      type: "error",
      mention: true,
    });

    throw new Error("Invalid QStash request signature.");
  }
};
