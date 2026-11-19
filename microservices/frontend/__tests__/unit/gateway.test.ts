/** @jest-environment node */
import { GatewayError, gatewayFetch, withLoginRedirect } from "@/lib/gateway";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

jest.mock("server-only", () => ({}));
// the real redirect() throws
jest.mock("next/navigation", () => ({
  redirect: jest.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const mockSession = (token: string | null) =>
  (createClient as jest.Mock).mockResolvedValue({
    auth: {
      getSession: async () => ({
        data: { session: token ? { access_token: token } : null },
      }),
    },
  });

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let fetchMock: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GATEWAY_URL = "http://gw";
  fetchMock = jest.fn().mockResolvedValue(json(200, { ok: true }));
  global.fetch = fetchMock as unknown as typeof fetch;
  mockSession("tok");
});

describe("gatewayFetch", () => {
  it("sends bearer token and JSON body", async () => {
    await gatewayFetch("/orders", { method: "POST", body: { a: 1 } });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://gw/orders");
    expect(init.headers.authorization).toBe("Bearer tok");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.body).toBe('{"a":1}');
  });

  it("builds query, skipping undefined", async () => {
    await gatewayFetch("/search", { query: { q: "rolex sub", page: 2, brand: undefined } });
    expect(fetchMock.mock.calls[0][0]).toBe("http://gw/search?q=rolex+sub&page=2");
  });

  it("auth=false sends no Authorization", async () => {
    await gatewayFetch("/search", { auth: false });
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBeUndefined();
  });

  it("parses problem+json", async () => {
    const problem = { type: "about:blank", title: "Conflict", status: 409, detail: "x" };
    fetchMock.mockResolvedValue(json(409, problem));
    await expect(gatewayFetch("/orders")).rejects.toMatchObject({
      status: 409,
      problem: { title: "Conflict" },
    });
  });

  it("network failure becomes 502", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    const err = (await gatewayFetch("/orders").catch((e) => e)) as GatewayError;
    expect(err).toBeInstanceOf(GatewayError);
    expect(err.status).toBe(502);
  });

  it("no session with auth=true is 401 and does not call fetch", async () => {
    mockSession(null);
    await expect(gatewayFetch("/orders")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns undefined on 204", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(gatewayFetch("/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});

describe("withLoginRedirect", () => {
  it("redirects to /login on 401", async () => {
    await expect(
      withLoginRedirect(async () => {
        throw new GatewayError(401, null, "unauthorized");
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("rethrows other errors", async () => {
    const err = new GatewayError(500, null, "boom");
    await expect(
      withLoginRedirect(async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(redirect).not.toHaveBeenCalled();
  });
});
