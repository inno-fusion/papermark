import { z } from "zod";

export const envSchema = z.object({
  SLACK_APP_INSTALL_URL: z.string(),
  SLACK_CLIENT_ID: z.string(),
  SLACK_CLIENT_SECRET: z.string(),
  SLACK_INTEGRATION_ID: z.string(),
});

type SlackEnv = z.infer<typeof envSchema>;

let env: SlackEnv | null | undefined;

/**
 * Check if Slack integration is configured
 */
export const isSlackConfigured = (): boolean => {
  return !!(
    process.env.SLACK_CLIENT_ID &&
    process.env.SLACK_CLIENT_SECRET &&
    process.env.SLACK_INTEGRATION_ID
  );
};

/**
 * Get Slack environment variables.
 * Returns null if Slack is not configured.
 */
export const getSlackEnv = (): SlackEnv | null => {
  if (env !== undefined) {
    return env;
  }

  // Check if any Slack vars are set
  const hasAnySlackVars =
    process.env.SLACK_CLIENT_ID ||
    process.env.SLACK_CLIENT_SECRET ||
    process.env.SLACK_INTEGRATION_ID;

  // If no Slack vars are set, Slack is simply not configured (graceful)
  if (!hasAnySlackVars) {
    env = null;
    return null;
  }

  // If some vars are set, validate all required vars are present
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.warn(
      "[Slack] Partially configured - some env vars are missing:",
      parsed.error.flatten().fieldErrors,
    );
    env = null;
    return null;
  }

  env = parsed.data;
  return env;
};
