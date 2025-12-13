// DEPRECATED: This endpoint was used by QStash for webhook delivery callbacks.
// Webhook delivery is now handled by BullMQ workers directly.
// This endpoint is kept for backwards compatibility but will be removed in a future version.

export const POST = async (req: Request) => {
  console.warn(
    "[DEPRECATED] /api/webhooks/callback endpoint called. " +
      "Webhook delivery is now handled by BullMQ workers. " +
      "This endpoint will be removed in a future version.",
  );

  return new Response(
    "This endpoint is deprecated. Webhook delivery is now handled by BullMQ workers.",
    { status: 200 },
  );
};
