"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-runs the server page every few seconds (the payment webhook may land after the redirect).
export default function AutoRefresh({ everyMs = 3000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(id);
  }, [router, everyMs]);
  return null;
}
