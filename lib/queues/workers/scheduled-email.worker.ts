import { Job, Worker } from "bullmq";

import { sendDataroomInfoEmail } from "@/lib/emails/send-dataroom-info";
import { sendDataroomTrial24hReminderEmail } from "@/lib/emails/send-dataroom-trial-24h";
import { sendDataroomTrialEndEmail } from "@/lib/emails/send-dataroom-trial-end";
import { sendUpgradeOneMonthCheckinEmail } from "@/lib/emails/send-upgrade-month-checkin";
import prisma from "@/lib/prisma";

import { createRedisConnection } from "../connection";
import type { ScheduledEmailPayload } from "../types";

type ScheduledEmailResult = {
  success: boolean;
  emailType: string;
};

async function processScheduledEmail(
  job: Job<ScheduledEmailPayload>,
): Promise<ScheduledEmailResult> {
  const { emailType, to, name, teamId, useCase } = job.data;

  console.log(`[Email Worker] Sending ${emailType} to: ${to}`);

  try {
    switch (emailType) {
      case "dataroom-trial-info":
        await sendDataroomInfoEmail(
          { user: { email: to, name: "Marc" } },
          useCase!,
        );
        console.log(`[Email Worker] Dataroom trial info email sent to ${to}`);
        break;

      case "dataroom-trial-24h":
        if (teamId) {
          const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { plan: true },
          });

          if (!team) {
            console.error(`[Email Worker] Team not found: ${teamId}`);
            return { success: false, emailType };
          }

          // Only send reminder email if team still has trial plan
          if (team.plan.includes("drtrial")) {
            await sendDataroomTrial24hReminderEmail({
              email: to,
              name: name!,
            });
            console.log(`[Email Worker] Trial 24h reminder sent to ${to}`);
          } else {
            console.log(
              `[Email Worker] Team upgraded - no trial reminder needed: ${teamId}`,
            );
          }
        }
        break;

      case "dataroom-trial-expired":
        if (teamId) {
          const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { plan: true },
          });

          if (!team) {
            console.error(`[Email Worker] Team not found: ${teamId}`);
            return { success: false, emailType };
          }

          if (team.plan.includes("drtrial")) {
            // Send email
            await sendDataroomTrialEndEmail({
              email: to,
              name: name!,
            });
            console.log(`[Email Worker] Trial expired email sent to ${to}`);

            // Remove trial on the plan
            const updatedTeam = await prisma.team.update({
              where: { id: teamId },
              data: { plan: team.plan.replace("+drtrial", "") },
            });

            const isPaid = [
              "pro",
              "business",
              "datarooms",
              "datarooms-plus",
            ].includes(updatedTeam.plan);

            if (!isPaid) {
              // Remove branding
              await prisma.brand.deleteMany({
                where: { teamId },
              });
              console.log(
                `[Email Worker] Branding removed after trial expired: ${teamId}`,
              );

              // Block all non-admin users
              const blockedUsers = await prisma.userTeam.updateMany({
                where: {
                  teamId,
                  role: { not: "ADMIN" },
                },
                data: {
                  status: "BLOCKED_TRIAL_EXPIRED",
                  blockedAt: new Date(),
                },
              });
              console.log(
                `[Email Worker] Team members blocked: ${blockedUsers.count}`,
              );
            }

            console.log(`[Email Worker] Trial removed: ${teamId}`);
          } else {
            console.log(
              `[Email Worker] Team upgraded - no further action: ${teamId}`,
            );
          }
        }
        break;

      case "upgrade-checkin":
        if (teamId) {
          const team = await prisma.team.findUnique({
            where: { id: teamId },
            select: { plan: true },
          });

          if (!team) {
            console.error(`[Email Worker] Team not found: ${teamId}`);
            return { success: false, emailType };
          }

          if (
            ["pro", "business", "datarooms", "datarooms-plus"].includes(
              team.plan,
            )
          ) {
            await sendUpgradeOneMonthCheckinEmail({
              user: { email: to, name: name! },
            });
            console.log(`[Email Worker] Upgrade checkin email sent to ${to}`);
          } else {
            console.log(
              `[Email Worker] Team not on paid plan - no checkin email: ${teamId}`,
            );
          }
        }
        break;

      default:
        console.error(`[Email Worker] Unknown email type: ${emailType}`);
        return { success: false, emailType };
    }

    return { success: true, emailType };
  } catch (error) {
    console.error(`[Email Worker] Job ${job.id} failed:`, error);
    throw error;
  }
}

export function createScheduledEmailWorker() {
  const worker = new Worker<ScheduledEmailPayload, ScheduledEmailResult>(
    "scheduled-email",
    processScheduledEmail,
    {
      connection: createRedisConnection(),
      concurrency: 5,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[Email Worker] Job ${job.id} completed`),
  );
  worker.on("failed", (job, err) =>
    console.error(`[Email Worker] Job ${job?.id} failed:`, err.message),
  );

  return worker;
}
