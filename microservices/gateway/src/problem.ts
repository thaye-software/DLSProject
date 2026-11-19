import type { Response } from "express";

export type Problem = {
  code: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  // RFC 9457 extension members, e.g. unavailable_product_ids.
  extensions?: Record<string, unknown>;
};

export function sendProblem(response: Response, problem: Problem): void {
  response
    .status(problem.status)
    .type("application/problem+json")
    .send(
      JSON.stringify({
        type: `https://limitedwatches.dk/problems/${problem.code}`,
        title: problem.title,
        status: problem.status,
        detail: problem.detail,
        instance: problem.instance,
        ...problem.extensions,
      }),
    );
}
