"use client";

import { useRouter } from "next/navigation"; // ✅ use next/navigation, not next/router
import { useEffect } from "react";
import { toast } from "sonner";

export default function ToastWrapper({ state }: { state: any }) {
  const router = useRouter(); // ✅ Must be top-level

  useEffect(() => {
    if (state?.message) {

      if (state.success) {
        toast.success(state.message);

      } else {
        toast.error(state.message);
      }
    }

    if (state?.redirectUrl) {
      router.push(state.redirectUrl);
    }
  }, [state, router]);

  return null;
  // The <Toaster /> component can be found in the root layout
}
