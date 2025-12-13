import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Slack integration...");

  const slackIntegration = await prisma.integration.upsert({
    where: { slug: "slack" },
    update: {},
    create: {
      name: "Slack",
      slug: "slack",
      description:
        "Get real-time notifications in Slack when documents are viewed, downloaded, or datarooms are accessed.",
      developer: "Papermark",
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
