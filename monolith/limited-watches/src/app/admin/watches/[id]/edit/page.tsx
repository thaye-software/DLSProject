import { getProductById } from "@/services/productService";
import Link from "next/link";
import CreateWatchForm from "@/components/Admin/Watches/CreateWatchForm";
import { getAllBrands } from "@/services/brandService";
import { Suspense } from "react";

export default async function EditWatchPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params;

  const product = await getProductById(id);

  if (!product) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Watch not found</h1>
        <p>We couldn't find a product with id {id}.</p>
        <Link
          href="/admin/watches"
          className="text-sm text-primary mt-4 inline-block"
        >
          Back to list
        </Link>
      </div>
    );
  }

  const initialBrands = (await getAllBrands()) || [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit watch</h1>
        <Link href="/admin/watches" className="text-sm text-muted-foreground">
          Back to list
        </Link>
      </div>
      <Suspense fallback={<div>Loading...</div>}>
        <CreateWatchForm initialBrands={initialBrands} initialProduct={product} />
      </Suspense>
    </div>
  );
}
