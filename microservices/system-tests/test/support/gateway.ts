import { services, type Service } from "./stack.js";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiResponse<T = any> = { status: number; body: T };

export type CallOptions = { body?: unknown; headers?: Record<string, string> };

// The compose stack has no API Gateway, so this does its forward-auth step: GET /verify on Auth, then the
// service with Auth's X-User-* headers, or Auth's own answer when it is not 200.
export class Gateway {
  constructor(private readonly token: string | null) {}

  async call(service: Service, method: Method, path: string, options: CallOptions = {}): Promise<ApiResponse> {
    const verdict = await fetch(`${services.auth}/verify`, {
      headers: {
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        "x-forwarded-method": method,
        "x-forwarded-uri": path,
      },
    });
    if (verdict.status !== 200) return { status: verdict.status, body: await bodyOf(verdict) };

    const identity = {
      "x-user-id": verdict.headers.get("x-user-id") ?? "",
      "x-user-email": verdict.headers.get("x-user-email") ?? "",
      "x-user-role": verdict.headers.get("x-user-role") ?? "",
    };
    return send(service, method, path, { ...options, headers: { ...options.headers, ...identity } });
  }
}

export function publicCall(service: Service, method: Method, path: string, options: CallOptions = {}): Promise<ApiResponse> {
  return send(service, method, path, options);
}

async function send(service: Service, method: Method, path: string, { body, headers }: CallOptions): Promise<ApiResponse> {
  const response = await fetch(`${services[service]}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await bodyOf(response) };
}

async function bodyOf(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
