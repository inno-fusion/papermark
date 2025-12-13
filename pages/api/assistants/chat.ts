import { experimental_AssistantResponse } from "ai";
import { type MessageContentText } from "openai/resources/beta/threads/messages/messages";
import { type Run } from "openai/resources/beta/threads/runs/runs";

import { openai } from "@/lib/openai";
import { rateLimit, isRedisConfigured } from "@/lib/redis";

// Rate limit configurations
const rateLimitConfigs = {
  // 3 requests per hour for public/unauthenticated users
  public: {
    limit: 3,
    windowSeconds: 60 * 60, // 1 hour
    prefix: "ratelimit:assistant:public",
  },
  // 3 requests per day for free users
  free: {
    limit: 3,
    windowSeconds: 60 * 60 * 24, // 24 hours
    prefix: "ratelimit:assistant:free",
  },
} as const;

// IMPORTANT! Set the runtime to edge
export const config = {
  runtime: "edge",
};

export default async function POST(req: Request) {
  // Parse the request body
  const input: {
    threadId: string | null;
    message: string;
    isPublic: boolean | null;
    userId: string | null;
    plan: string | null;
  } = await req.json();

  // Only apply rate limiting if Redis is configured
  if (isRedisConfigured()) {
    if (input.isPublic) {
      const ip = req.headers.get("x-forwarded-for") || "unknown";
      const config = rateLimitConfigs.public;
      const key = `${config.prefix}:${ip}`;

      const result = await rateLimit(key, config.limit, config.windowSeconds);

      if (!result.success) {
        return new Response("You have reached your request limit for the day.", {
          status: 429,
          headers: {
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.reset.toString(),
          },
        });
      }
    }

    if (input.userId && input.plan !== "pro") {
      const config = rateLimitConfigs.free;
      const key = `${config.prefix}:${input.userId}`;

      const result = await rateLimit(key, config.limit, config.windowSeconds);

      if (!result.success) {
        return new Response("You have reached your request limit for the day.", {
          status: 429,
          headers: {
            "X-RateLimit-Limit": result.limit.toString(),
            "X-RateLimit-Remaining": result.remaining.toString(),
            "X-RateLimit-Reset": result.reset.toString(),
          },
        });
      }
    }
  }

  // create a threadId if one wasn't provided
  const threadId = input.threadId ?? (await openai.beta.threads.create()).id;

  // Add a message to the thread
  const createdMessage = await openai.beta.threads.messages.create(threadId, {
    role: "user",
    content: input.message,
  });

  // select the assistantId based on the isPublic flag
  const assistantId = input.isPublic
    ? (process.env.OAI_PUBLIC_ASSISTANT_ID as string)
    : (process.env.OAI_ASSISTANT_ID as string);

  return experimental_AssistantResponse(
    {
      threadId,
      messageId: createdMessage.id,
    },
    async ({ threadId, sendMessage }) => {
      // Run the assistant on the thread
      const run = await openai.beta.threads.runs.create(threadId, {
        assistant_id: assistantId!,
      });

      async function waitForRun(run: Run) {
        // Poll for status change
        while (run.status === "queued" || run.status === "in_progress") {
          // delay for 500ms:
          await new Promise((resolve) => setTimeout(resolve, 500));

          run = await openai.beta.threads.runs.retrieve(threadId!, run.id);
        }

        // Check the run status
        if (
          run.status === "cancelled" ||
          run.status === "cancelling" ||
          run.status === "failed" ||
          run.status === "expired"
        ) {
          throw new Error(run.status);
        }
      }

      await waitForRun(run);

      // Get new thread messages (after our message)
      const responseMessages = (
        await openai.beta.threads.messages.list(threadId, {
          after: createdMessage.id,
          order: "asc",
        })
      ).data;

      // Send the messages
      for (const message of responseMessages) {
        sendMessage({
          id: message.id,
          role: "assistant",
          content: message.content.filter(
            (content) => content.type === "text",
          ) as Array<MessageContentText>,
        });
      }
    },
  );
}
