import BackButton from "@/components/BackButton";
import ProductImageSwiper from "@/components/Watches/ProductImageSwiper";
import { getProductBySlug } from "@/services/productService";
import { notFound } from "next/navigation";
import {
  Check,
  Shield,
  Package,
  FileText,
  Calendar,
  Gauge,
  Clock,
  ShoppingBasket,
  Ruler,
  Star,
} from "lucide-react";
import { convertPrice } from "@/services/currencyService";
import ProductSafetyInfo from "@/components/Watches/ProductSafetyInfoCard";
import AddToCartButton from "@/components/Watches/AddToCartButton";
import ContactButton from "@/components/Contact/ContactButton";
import { Button } from "@/components/ui/button";
import constants from "@/lib/constants";

function getOptionName(
  options: { id: number; name: string }[],
  val: string
) {
  const id = Number(val);
  return options.find((o) => o.id === id)?.name;
}

export default async function ViewWatchPage({
  params,
}: {
  params: Promise<{ watchSlug: string }>;
}) {
  const product = await getProductBySlug((await params).watchSlug);
  if (!product) {
    return notFound();
  }
  const formattedPrice = await convertPrice(product?.priceDkk, "dkk");

  let brandName = "";
  let productSafetyInfo = null;
  if (product) {
    brandName = product.watch.brand.name;

    productSafetyInfo = {
      id: product?.watch?.brand.id,
      country: product?.watch?.brand.country,
      address: product?.watch?.brand.addressLine1,
      address2: product?.watch?.brand.addressLine2,
      zipCode: product?.watch?.brand.zipCode,
      city: product?.watch?.brand.city,
      stateProvince: product?.watch?.brand.stateProvince,
      phoneNumber: product?.watch?.brand.phoneNumber,
      email: product?.watch?.brand.email,
      website: product?.watch?.brand.website,
    };
  }

  //TODO use either headers/cookies to find out location of user to display correct currency.
  // formattedPrice = convertPrice(product?.priceDkk, "dkk");

  if (!product) {
    return (
      <div className="min-h-screen flex">
        <div className="text-center text-lg text-[#244B5A]">
          Loading product...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen container mx-auto">
      <div className="mx-auto py-6">
        <BackButton />
      </div>
      {/* Main Content */}
      <div className="mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column - Image Swiper */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <ProductImageSwiper product={product} />
          </div>

          {/* Right Column - Product Details */}
          <div className="space-y-8">
            {/* Brand & Model */}
            <div className="border-b pb-6">
              <div className="text-lg font-medium tracking-widest uppercase mb-2">
                {brandName}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-3">
                {product.watch.model || "Unknown Model"}
              </h1>
              <p className="text-sm">
                Reference: {product.watch.reference || "N/A"}
              </p>
            </div>

            {/* Price */}
            <div>
              <div className="text-4xl font-bold">{formattedPrice}</div>
              <div className="text-muted-foreground text-xs mt-2">
                Including {product.watch.vat || 0}% VAT
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-xl font-semibold mb-3">Description</h2>
              <p className="leading-relaxed">
                {product.description ||
                  "No description available for this watch."}
              </p>
            </div>

            {/* Specifications Grid */}
            <div>
              <div className="grid grid-cols-2 gap-4">
                <SpecItem
                  icon={<Ruler size={18} />}
                  label="Size"
                  value={product.watch.size || "Not specified"}
                />
                <SpecItem
                  icon={<Clock size={18} />}
                  label="Movement"
                  value={
                    getOptionName(
                      constants.MOVEMENT_OPTIONS,
                      product.watch.movement
                    ) ?? "Not specified"
                  }
                />
                <SpecItem
                  icon={<Calendar size={18} />}
                  label="Year"
                  value={
                    product.watch.year
                      ? product.watch.year.toString()
                      : "Not specified"
                  }
                />
                <SpecItem
                  label="Glass"
                  value={
                    getOptionName(
                      constants.GLASS_OPTIONS,
                      product.watch.glassType
                    ) ?? "Not specified"
                  }
                />
                <SpecItem
                  label="Dial Color"
                  value={product.watch.dialColor || "Not specified"}
                />
                <SpecItem
                  label="Bracelet"
                  value={(() => {
                    const name = getOptionName(
                      constants.BRACELET_OPTIONS,
                      product.watch.braceletType
                    );
                    if (name)
                      return `${name}${
                        product.watch.braceletColor
                          ? ` (${product.watch.braceletColor})`
                          : ""
                      }`;
                    if (
                      product.watch.braceletType ||
                      product.watch.braceletColor
                    )
                      return `${product.watch.braceletType ?? ""}${
                        product.watch.braceletColor
                          ? ` (${product.watch.braceletColor})`
                          : ""
                      }`;
                    return "Not specified";
                  })()}
                />
                <SpecItem
                  label="Condition"
                  value={
                    product.watch.condition
                      ? `${product.watch.condition}/10`
                      : "Not specified"
                  }
                />
              </div>
            </div>

            {/* Included Items */}
            <div className="border border-[#D3C6A3] rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Package size={20} className="" />
                Included with Purchase
              </h3>
              <div className="space-y-3">
                <IncludedItem
                  included={product.watch.box}
                  text="Original Box"
                />
                <IncludedItem
                  included={product.watch.papers}
                  text="Original Papers & Documentation"
                />
                <IncludedItem
                  included={true}
                  text="Certificate of Authenticity"
                />
              </div>
            </div>

            {/* Limited Edition Badge */}
            {product.watch.limited && (
              <div className="bg-linear-to-r from-[#773D0E]/20 to-[#5E561C]/20 border border-[#773D0E]/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-[#773D0E] font-semibold">
                  <Star size={20} />
                  Limited Edition
                </div>
              </div>
            )}

            {/* Stock Status */}
            <div className="flex items-center gap-2 text-sm">
              {product.stock > 0 ? (
                <>
                  <div className="w-2 h-2 bg-emerald-600 rounded-full animate-pulse"></div>
                  <span className="text-emerald-600 font-medium">
                    In Stock ({product.stock} available)
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-[#773D0E] rounded-full"></div>
                  <span className="text-[#773D0E] font-medium">
                    Out of Stock
                  </span>
                </>
              )}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button className="cursor-pointer h-12 font-bold transition-all flex-1 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100">
                <ShoppingBasket />
                Buy now
              </Button>

              <ContactButton productId={product.id} />
            </div>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#D3C6A3]">
              <TrustBadge icon={<Shield size={24} />} text="Authenticated" />
              <TrustBadge
                icon={<Package size={24} />}
                text="Insured Shipping"
              />
              <TrustBadge
                icon={<FileText size={24} />}
                text="2 Year Warranty"
              />
            </div>
          </div>
        </div>
      </div>
      {/* Product Safety Information */}
      <div>
        {productSafetyInfo ? (
          // TODO fix this in the schema and do migration...
          // this error can be ignored since the "productSaftInfo check catches it."
          // either way this should never be optional anyways
          <ProductSafetyInfo
            brandName={brandName}
            safetyInfo={productSafetyInfo}
          />
        ) : (
          <h1 className="flex justify-center text-lg">
            Product Safty Information not available
          </h1>
        )}
      </div>
    </div>
  );
}

// --------------------------------------- Helper Components ---------------------------------------

function SpecItem({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="border-[#D3C6A3] rounded-lg p-3">
      <div className="flex items-center gap-2 text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function IncludedItem({ included, text }: { included: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
          included ? "" : ""
        }`}
      >
        {included && <Check size={14} />}
      </div>
      <span className={included ? "" : "line-through"}>{text}</span>
    </div>
  );
}

function TrustBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="">{icon}</div>
      <span className="text-muted-foreground text-xs font-medium">{text}</span>
    </div>
  );
}
