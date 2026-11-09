import "server-only";
import { GatewayError } from "@/lib/gateway";

// Shows the service's problem+json title/detail when there is one; logs everything else.
export function problemMessage(e: unknown, generic: string, logLabel: string): string {
  if (e instanceof GatewayError && e.problem) {
    return [e.problem.title, e.problem.detail].filter(Boolean).join(": ");
  }
  console.error(logLabel, e);
  return generic;
}
