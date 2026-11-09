import { NotAvailable } from "@/components/NotAvailable";

// Deferred, not in the microservice scope
export default function Page() {
  return <NotAvailable feature="Watch administration" />;
}
