import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Problem = { type: string; title: string; status: number; detail?: string };

export class GatewayError extends Error {
  constructor(
    public status: number,
    public problem: Problem | null,
    message?: string,
  ) {
    super(message ?? problem?.detail ?? problem?.title ?? `Gateway error ${status}`);
    this.name = "GatewayError";
  }
}

export async function gatewayFetch<T>(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    query?: Record<string, string | number | undefined>;
    auth?: boolean;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const { method = "GET", body, query, auth = true } = init;
  const headers: Record<string, string> = { ...init.headers };

  if (auth) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new GatewayError(401, null, "Not signed in");
    headers.authorization = `Bearer ${data.session.access_token}`;
  }
  if (body !== undefined) headers["content-type"] = "application/json";

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) params.set(k, String(v));
  const qs = params.size ? `?${params}` : "";

  let res: Response;
  try {
    res = await fetch(`${process.env.GATEWAY_URL}${path}${qs}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (e) {
    throw new GatewayError(502, null, `Gateway unreachable: ${(e as Error).message}`);
  }

  if (!res.ok) {
    const problem = await res.json().then(
      (p) => (p && typeof p.title === "string" && typeof p.status === "number" ? (p as Problem) : null),
      () => null,
    );
    throw new GatewayError(res.status, problem);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function withLoginRedirect<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    if (e instanceof GatewayError && e.status === 401) redirect("/login");
    throw e;
  }
}
