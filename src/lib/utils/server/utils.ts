import "server-only";

import { headers } from "next/headers";

import { createClient } from "@/database/supabase/server";
import { getUserById } from "@/services/userService";

export async function getSignedInUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { data: { user }, error };
}

export async function getAuthUser() {
  const supabase = await createClient();
  let loading = true;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    loading = false;
    return { user: null, loading, role: null, avatarUrl: null, username: null };
  }
  const username = user.user_metadata?.display_name || null;
  const dbUser = await getUserById(user.id);
  const role = dbUser ? dbUser.role : null;
  const avatarUrl = dbUser ? dbUser.avatarUrl : null;
  loading = false;
  return { user, loading, role, avatarUrl, username };
}

export async function getUserLocation() {
  const headersList = await headers();
  // x-forwarded-for can contain a comma separated list; take first
  const ipRaw =
    (headersList.get("x-forwarded-for") as string) ||
    (headersList.get("x-real-ip") as string) ||
    "unknown";
  const ip = (ipRaw || "").split(",")[0].trim();

  const defaultLocation = {
    country: "Denmark",
    countryCode: "DK",
    city: "Copenhagen",
    currency: "DKK",
  };

  function isPrivateIp(addr: string) {
    if (!addr) return true;
    if (addr === "::1" || addr === "127.0.0.1" || addr === "unknown")
      return true;
    // simple private range checks
    if (addr.startsWith("10.")) return true;
    if (addr.startsWith("172.")) return true;
    if (addr.startsWith("192.168.")) return true;
    if (addr.startsWith("169.254.")) return true;
    return false;
  }

  if (isPrivateIp(ip)) {
    console.log(
      "Local development or private network detected, using default location (Denmark/Copenhagen)"
    );
    return defaultLocation;
  }

  // Production/deployed: use real IP. Be defensive: ipapi (or any proxy) may return HTML on errors.
  try {
    const response = await fetch(
      `https://ipapi.co/${encodeURIComponent(ip)}/json/`
    );

    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      console.warn("ipapi responded with non-ok status", response.status);
      return defaultLocation;
    }

    if (!contentType.includes("application/json")) {
      // Defensive: sometimes proxies or blocks return HTML pages
      const text = await response.text();
      console.warn(
        "ipapi returned non-json response, falling back to default. Response snippet:",
        text.slice(0, 300)
      );
      return defaultLocation;
    }

    const data = await response.json();

    return {
      country: (data.country_name as string) || defaultLocation.country,
      countryCode: (data.country_code as string) || defaultLocation.countryCode,
      city: (data.city as string) || defaultLocation.city,
      currency: (data.currency as string) || defaultLocation.currency,
    };
  } catch (err) {
    console.warn(
      "Failed to fetch ipapi for user location, falling back to default:",
      err
    );
    return defaultLocation;
  }
}
