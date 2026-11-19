import type { ServiceName } from "./config.js";

export type AuthMode = "required" | "optional" | "none";
export type Route = { prefix: string; service: ServiceName; auth: AuthMode };

export const ROUTES: readonly Route[] = [
  { prefix: "/orders", service: "orders", auth: "required" },
  { prefix: "/payments", service: "payment", auth: "required" },
  { prefix: "/webhooks/stripe", service: "payment", auth: "none" },
  { prefix: "/webhooks/supabase/email-confirmed", service: "users", auth: "none" },
  { prefix: "/contact", service: "notif", auth: "none" },
  { prefix: "/products", service: "catalog", auth: "optional" },
  { prefix: "/search", service: "search", auth: "optional" },
  { prefix: "/conversations", service: "messaging", auth: "required" },
];

// Matches on a normalised copy of the path; the proxy still forwards the original URL.
export function matchRoute(path: string): Route | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(path.split("?")[0]!);
  } catch {
    return null;
  }
  const normalised = decoded.toLowerCase().replace(/\/{2,}/g, "/");
  const segments = normalised.split("/").filter((segment) => segment !== "");
  if (segments.some((segment) => segment === ".." || segment === ".") || segments[0] === "internal") return null;
  return ROUTES.find((r) => normalised === r.prefix || normalised.startsWith(`${r.prefix}/`)) ?? null;
}
