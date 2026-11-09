"use client";

import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-6">We could not load this page right now. Please try again.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
