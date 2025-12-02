import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import CreateWatchForm from "@/components/Admin/Watch/CreateWatchForm";
import { getAllBrands } from "@/services/brandService";

export default async function NewWatchPage() {
  // fetch brands on the server (avoids passing functions / handlers to client)

  const initialBrands = (await getAllBrands()) || [];

  return (
    <div>
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/admin/watches"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft />
            Back
          </Link>
          <h1 className="text-2xl font-semibold">New Watch</h1>
          <div />
        </div>
      </div>

      {/* Pass only serializable data (promise/array) to the client component */}
      <CreateWatchForm initialBrands={initialBrands} />
    </div>
  );
}
