import posthog from "posthog-js";

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (PH_KEY) {
  posthog.init(PH_KEY, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2025-05-24",
    capture_exceptions: true,
    // debug: process.env.NODE_ENV === "development",
  });
} else {
  // Avoid initializing PostHog without a token (prevents runtime error in production)
  // If you expect analytics in production, ensure `NEXT_PUBLIC_POSTHOG_KEY` is set at build time.
  // eslint-disable-next-line no-console
  console.warn("PostHog not initialized: NEXT_PUBLIC_POSTHOG_KEY is not set");
}
