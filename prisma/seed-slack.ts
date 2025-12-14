import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Fixed ID for Slack integration - same across all instances
const SLACK_INTEGRATION_FIXED_ID = "clslackintegration0x";

async function main() {
  console.log("Seeding Slack integration...");

  const slackIntegration = await prisma.integration.upsert({
    where: { slug: "slack" },
    update: {},
    create: {
      id: SLACK_INTEGRATION_FIXED_ID,
      name: "Slack",
      slug: "slack",
      description:
        "Get real-time notifications in Slack when documents are viewed, downloaded, or datarooms are accessed.",
      developer: "0xMetaLabs",
      website: "https://slack.com",
      logo: "https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png",
      verified: true,
      category: "notifications",
    },
  });

  console.log("Created Slack integration:", slackIntegration.id);
  console.log("");
  console.log("Add this to your .env file:");
  console.log(`SLACK_INTEGRATION_ID=${slackIntegration.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
