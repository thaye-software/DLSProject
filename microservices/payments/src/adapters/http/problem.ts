import type { Response } from "express";

export type Problem = {
  code: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
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
      }),
    );
}
