import type { Instrumentation } from "next";

import { logEvent } from "@/lib/log";

/**
 * Every server error Next.js catches (pages, Server Actions, route handlers)
 * becomes one structured log line. Paths are scrubbed by the logger, so a
 * card token in /card/<token> never reaches the logs.
 * Error tracking with alerts: docs/production-checklist.md (Sentry / log drain).
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
  logEvent("error", "request_error", {
    method: request.method,
    path: request.path,
    route: context.routePath,
    routeType: context.routeType,
    digest,
    error,
  });
};
