import { get } from "@vercel/edge-config";

export type BetaFeatures =
  | "tokens"
  | "incomingWebhooks"
  | "roomChangeNotifications"
  | "webhooks"
  | "conversations"
  | "dataroomUpload"
  | "inDocumentLinks"
  | "usStorage"
  | "dataroomIndex"
  | "slack"
  | "annotations"
  | "dataroomInvitations"
  | "workflows";

type BetaFeaturesRecord = Record<BetaFeatures, string[]>;

// Features that require additional infrastructure and should NOT be enabled by default
// These need explicit configuration or feature flags
const INFRASTRUCTURE_DEPENDENT_FEATURES: BetaFeatures[] = [
  "usStorage", // Requires separate US storage bucket configuration
];

export const getFeatureFlags = async ({ teamId }: { teamId?: string }) => {
  const teamFeatures: Record<BetaFeatures, boolean> = {
    tokens: false,
    incomingWebhooks: false,
    roomChangeNotifications: false,
    webhooks: false,
    conversations: false,
    dataroomUpload: false,
    inDocumentLinks: false,
    usStorage: false,
    dataroomIndex: false,
    slack: false,
    annotations: false,
    dataroomInvitations: false,
    workflows: false,
  };

  // Return most features as true if edge config is not available (self-hosting)
  // But keep infrastructure-dependent features disabled
  if (!process.env.EDGE_CONFIG) {
    return Object.fromEntries(
      Object.entries(teamFeatures).map(([key, _v]) => [
        key,
        !INFRASTRUCTURE_DEPENDENT_FEATURES.includes(key as BetaFeatures),
      ]),
    );
  } else if (!teamId) {
    return teamFeatures;
  }

  let betaFeatures: BetaFeaturesRecord | undefined = undefined;

  try {
    betaFeatures = await get("betaFeatures");
  } catch (e) {
    console.error(`Error getting beta features: ${e}`);
  }

  if (betaFeatures) {
    for (const [featureFlag, teamIds] of Object.entries(betaFeatures)) {
      if (teamIds.includes(teamId)) {
        teamFeatures[featureFlag as BetaFeatures] = true;
      }
    }
  }

  return teamFeatures;
};
