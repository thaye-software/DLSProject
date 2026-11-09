import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import BuyButton from "@/components/Watches/BuyButton";
import { formatMoney } from "@/lib/money";
import { getProduct } from "@/services/productService";
import { watchHref } from "@/services/searchService";

export const dynamic = "force-dynamic";

// ProductSummary has no description, gallery or specs, so this page is thin (contract gap).
export default async function WatchPage({ params }: { params: Promise<{ id: string; slug: string }> }) {
  const { id, slug } = await params;
  const product = await getProduct(id);
  if (!product) notFound();
  if (product.slug !== slug) redirect(watchHref(product));

  return (
    <div className="container mx-auto px-4 py-8 grid gap-8 md:grid-cols-2">
      <div className="relative aspect-square overflow-hidden rounded-2xl">
        <Image
          src={product.thumbnail_url || "/sadly-no-image.png"}
          alt={product.name}
          fill
          className="object-cover"
          unoptimized // REMOVE THIS IN PRODUCTION
        />
      </div>
      <div className="flex flex-col gap-3">
        {product.brand_name && (
          <p className="text-xs text-muted-foreground font-semibold tracking-[0.2em] uppercase">
            {product.brand_name}
          </p>
        )}
        <h1 className="text-4xl font-bold">{product.name}</h1>
        {product.model && <p className="text-muted-foreground">{product.model}</p>}
        <p className="text-3xl font-bold">{formatMoney(product.price)}</p>
        <p className="capitalize text-sm text-muted-foreground">{product.availability}</p>
        <BuyButton productId={product.product_id} available={product.availability === "available"} />
      </div>
    </div>
  );
}
