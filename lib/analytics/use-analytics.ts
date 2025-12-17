"use client";

import posthog from "posthog-js";
import { useCallback, useMemo } from "react";

import { getPostHogConfig } from "@/lib/posthog";

type AnalyticsProps = Record<string, unknown>;

interface Analytics {
  capture: (eventName: string, properties?: AnalyticsProps) => void;
  identify: (userId?: string, properties?: AnalyticsProps) => void;
  reset: () => void;
}

export function useAnalytics(): Analytics {
  const posthogConfig = getPostHogConfig();
  const isEnabled = typeof window !== "undefined" && posthogConfig !== null;

  const capture = useCallback(
    (eventName: string, properties?: AnalyticsProps) => {
      if (isEnabled) {
        posthog.capture(eventName, properties);
      }
    },
    [isEnabled],
  );

  const identify = useCallback(
    (userId?: string, properties?: AnalyticsProps) => {
      if (isEnabled && userId) {
        posthog.identify(userId, properties);
      }
    },
    [isEnabled],
  );

  const reset = useCallback(() => {
    if (isEnabled) {
      posthog.reset();
    }
  }, [isEnabled]);

  return useMemo(
    () => ({
      capture,
      identify,
      reset,
    }),
    [capture, identify, reset],
  );
}
