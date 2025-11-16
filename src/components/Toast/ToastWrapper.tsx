"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

export default function ToastWrapper({ state }: { state: any }) {
  const router = useRouter();

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
  }, [router]);

  return null;
  // The <Toaster /> component can be found in the root layout
}
