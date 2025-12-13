import { NextApiRequest, NextApiResponse } from "next";

import { PAUSE_COUPON_ID } from "@/ee/features/billing/cancellation/constants";
import { stripeInstance } from "@/ee/stripe";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { waitUntil } from "@vercel/functions";
import { getServerSession } from "next-auth/next";

import prisma from "@/lib/prisma";
import { pauseResumeQueue, automaticUnpauseQueue } from "@/lib/queues";
import { CustomUser } from "@/lib/types";
import { log } from "@/lib/utils";

export const config = {
  // in order to enable `waitUntil` function
  supportsResponseStreaming: true,
};

export async function handleRoute(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    // POST /api/teams/:teamId/billing/pause – pause a user's subscription
    const session = await getServerSession(req, res, authOptions);
    if (!session) {
      res.status(401).end("Unauthorized");
      return;
    }

    const userId = (session.user as CustomUser).id;
    const { teamId } = req.query as { teamId: string };

    try {
      const team = await prisma.team.findUnique({
        where: {
          id: teamId,
          users: {
            some: {
              userId: userId,
            },
          },
        },
        select: {
          id: true,
          stripeId: true,
          subscriptionId: true,
          endsAt: true,
          plan: true,
          limits: true,
        },
      });

      if (!team) {
        return res.status(400).json({ error: "Team does not exist" });
      }

      if (!team.stripeId) {
        return res.status(400).json({ error: "No Stripe customer ID" });
      }

      if (!team.subscriptionId) {
        return res.status(400).json({ error: "No subscription ID" });
      }

      const isOldAccount = team.plan.includes("+old");
      const stripe = stripeInstance(isOldAccount);

      const pauseStartsAt = team.endsAt ? new Date(team.endsAt) : new Date();
      const pauseEndsAt = new Date(pauseStartsAt);
      pauseEndsAt.setDate(pauseStartsAt.getDate() + 90);
      const reminderAt = new Date(pauseEndsAt);
      reminderAt.setDate(pauseEndsAt.getDate() - 3);

      // Pause the subscription in Stripe
      await stripe.subscriptions.update(team.subscriptionId, {
        discounts: [
          {
            coupon:
              PAUSE_COUPON_ID[isOldAccount ? "old" : "new"][
                process.env.VERCEL_ENV === "production" ? "prod" : "test"
              ],
          },
        ],
        metadata: {
          pause_starts_at: pauseStartsAt.toISOString(),
          pause_ends_at: pauseEndsAt.toISOString(),
          paused_reason: "user_request",
          original_plan: team.plan,
          pause_coupon_id:
            PAUSE_COUPON_ID[isOldAccount ? "old" : "new"][
              process.env.VERCEL_ENV === "production" ? "prod" : "test"
            ],
        },
      });

      await prisma.team.update({
        where: { id: teamId },
        data: {
          pausedAt: new Date(),
          pauseStartsAt,
          pauseEndsAt,
        },
      });

      // Calculate delays in milliseconds
      const reminderDelayMs = reminderAt.getTime() - Date.now();
      const unpauseDelayMs = pauseEndsAt.getTime() - Date.now();

      waitUntil(
        Promise.all([
          // Schedule the pause resume notification (3 days before pause ends)
          pauseResumeQueue.add(
            "pause-resume-notification",
            { teamId },
            {
              delay: Math.max(0, reminderDelayMs),
              jobId: `pause-resume-${teamId}-${Date.now()}`,
            },
          ),
          // Schedule automatic unpause when the 3-month pause period ends
          automaticUnpauseQueue.add(
            "automatic-unpause",
            { teamId },
            {
              delay: Math.max(0, unpauseDelayMs),
              jobId: `automatic-unpause-${teamId}-${Date.now()}`,
            },
          ),

          log({
            message: `Team ${teamId} (${team.plan}) paused their subscription for 3 months.`,
            type: "info",
          }),
        ]),
      );

      res.status(200).json({
        success: true,
        message: "Subscription paused successfully",
      });
    } catch (error) {
      console.error("Error pausing subscription:", error);
      await log({
        message: `Error pausing subscription for team ${teamId}: ${error}`,
        type: "error",
      });
      res.status(500).json({ error: "Failed to pause subscription" });
    }
  } else {
    res.setHeader("Allow", ["POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
