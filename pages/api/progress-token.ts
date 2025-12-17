import { NextApiRequest, NextApiResponse } from "next";

/**
 * Progress Token API Route
 *
 * This endpoint was previously used for Trigger.dev realtime progress updates.
 * Since migrating to BullMQ, progress tracking now uses polling via /api/jobs/progress.
 * This endpoint returns a stub token for backwards compatibility with existing UI components.
 *
 * The token is not actually used - see lib/progress/use-job-progress.ts where
 * _publicAccessToken is explicitly ignored.
 */
export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { documentVersionId } = req.query;

  if (!documentVersionId || typeof documentVersionId !== "string") {
    return res.status(400).json({ error: "Document version ID is required" });
  }

  // Return a stub token for backwards compatibility
  // The actual progress tracking uses BullMQ polling, not realtime tokens
  return res.status(200).json({
    publicAccessToken: `stub-token-${documentVersionId}`,
  });
}
