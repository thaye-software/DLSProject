import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { jwtVerify } from "jose";

export const INTERNAL_JWT_SECRET = "auth-and-users-share-this-32-char-secret!";

export type StubAnswer = { status: number; body?: unknown };

export type StubUsers = {
  url: string;
  // What GET /internal/users/{id} answers for this user; unknown users get 404.
  answer(userId: string, answer: StubAnswer): void;
  // The user ids asked for, in order.
  calls(): string[];
  // Service tokens that Users would have rejected.
  rejectedTokens(): number;
  close(): Promise<void>;
};

// Stands in for Users' GET /internal/users/{user_id}, checking the service JWT with the same rules as
// users/src/adapters/http/service-auth.ts (HS256, iss auth, aud users, at most 60 s).
export async function startStubUsers(): Promise<StubUsers> {
  const answers = new Map<string, StubAnswer>();
  const calls: string[] = [];
  let rejected = 0;
  const key = new TextEncoder().encode(INTERNAL_JWT_SECRET);

  const server = createServer(async (request, response) => {
    const userId = /^\/internal\/users\/([^/]+)$/.exec(request.url ?? "")?.[1];
    if (!userId) {
      response.writeHead(404).end();
      return;
    }
    const token = /^Bearer (.+)$/.exec(request.headers.authorization ?? "")?.[1] ?? "";
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ["HS256"],
        issuer: "auth",
        audience: "users",
        requiredClaims: ["iat", "exp"],
        maxTokenAge: 60,
      });
      if (payload.exp! - payload.iat! > 60) throw new Error("lives longer than 60 s");
    } catch {
      rejected += 1;
      response.writeHead(401, { "content-type": "application/problem+json" }).end("{}");
      return;
    }

    calls.push(decodeURIComponent(userId));
    const answer = answers.get(decodeURIComponent(userId)) ?? { status: 404, body: { type: "https://limitedwatches.dk/problems/not_found" } };
    response.writeHead(answer.status, { "content-type": "application/json" });
    response.end(answer.body === undefined ? "" : JSON.stringify(answer.body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    answer: (userId, answer) => answers.set(userId, answer),
    calls: () => [...calls],
    rejectedTokens: () => rejected,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
