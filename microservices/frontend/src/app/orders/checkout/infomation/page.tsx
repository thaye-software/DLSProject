import { redirect } from "next/navigation";

import ShippingAndBillingForm from "@/components/Orders/Info/ShippingAndBillingForm";
import { NotAvailable } from "@/components/NotAvailable";

import { getAuthUser } from "@/lib/utils/server/utils";
import { formatMoney } from "@/lib/money";
import { getProduct } from "@/services/productService";

export const dynamic = "force-dynamic";

export default async function OrdersInfoPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product: productId } = await searchParams;
  const { user } = await getAuthUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(`/orders/checkout/infomation?product=${productId ?? ""}`)}`);
  }

  const product = productId ? await getProduct(productId) : null;
  if (!product || product.availability !== "available") return <NotAvailable feature="This watch" />;

  return (
    <ShippingAndBillingForm
      product={{
        id: product.product_id,
        name: [product.brand_name, product.name].filter(Boolean).join(" "),
        thumbnailUrl: product.thumbnail_url,
        priceFormatted: formatMoney(product.price),
      }}
    />
  );
}
