export function NotAvailable({ feature }: { feature: string }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center text-muted-foreground">
      {feature} is not available yet.
    </div>
  );
}
