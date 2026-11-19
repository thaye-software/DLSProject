import "server-only";
import { unstable_rethrow } from "next/navigation";
import { GatewayError } from "@/lib/gateway";

// Shows the service's problem+json title/detail when there is one; logs everything else.
export function problemMessage(e: unknown, generic: string, logLabel: string): string {
  unstable_rethrow(e); // redirect()/notFound() thrown inside a caller's try block must still propagate
  if (e instanceof GatewayError && e.problem) {
    return [e.problem.title, e.problem.detail].filter(Boolean).join(": ");
  }
  console.error(logLabel, e);
  return generic;
}
