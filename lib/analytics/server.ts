// Server-side analytics functions
// These are no-ops in self-hosted mode since posthog-node is not included
// The client-side posthog-js handles most analytics

interface TrackAnalyticsProps {
  event: string;
  [key: string]: string | number | boolean | null | undefined;
}

export async function trackAnalytics(props: TrackAnalyticsProps): Promise<void> {
  // Optional: Log events in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics] Track:", props.event, props);
  }
  // No-op in production for self-hosted - client-side PostHog handles analytics
}

export async function identifyUser(
  userId: string,
  _properties?: Record<string, string | number | boolean | null | undefined>,
): Promise<void> {
  // Optional: Log in development
  if (process.env.NODE_ENV === "development") {
    console.log("[Analytics] Identify:", userId);
  }
  // No-op in production for self-hosted - client-side PostHog handles identification
}
