"use client";

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
} from "lucide-react";
// import { currencyService } from "@/services/currencyService";
import ProductSafetyInfo from "@/components/Watches/ProductSafetyInfoCard";
import { Product } from "../../type";
import AddToCartButton from "@/components/Watches/AddToCartButton";
import { Button } from "@/components/ui/button";
import { useChatContext } from "@/context/ChatContext";
import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/lib/useSupabaseAuth";
import { createConversation } from "@/services/conversationService";

export default function ViewWatchPage({
  params,
}: {
  params: Promise<{ watchSlug: string }>;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const { setChatOpen, setInitialConversation } = useChatContext();
  const { user } = useSupabaseAuth();

  async function getProduct() {
    const p = await params;
    console.log("Fetching product for slug:", p);
    const slug = p.watchSlug;
    return await getProductBySlug(slug);
  }

  async function createNewConversation() {
    const productId = product ? product.id : null;
    const customerId = user ? user.id : null;
    if (!productId || !customerId) {
      console.error("Product ID or Customer ID is not available.");
      return;
    }
    const conversation = await createConversation(customerId, productId);
    console.log("Created conversation:", conversation);
    setInitialConversation(conversation);
  }

  async function handleContactClick() {
    await createNewConversation();
    setChatOpen(true);
  }

  useEffect(() => {
    const fetchProduct = async () => {
      const prod = await getProduct();
      console.log("Fetched product:", prod);
      if (!prod) {
        notFound();
      } else {
        setProduct(prod);
      }
    };
    fetchProduct();
  }, []);

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
  // const formattedPrice = await currencyService.convertPrice(product.priceDkk, "dkk")

  if (!product) {
    return (
      <div className="min-h-screen bg-[#F5F3EE] flex items-center justify-center">
        <div className="text-center text-lg text-[#244B5A]">
          Loading product...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EE]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <BackButton />
      </div>
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Column - Image Swiper */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <ProductImageSwiper product={product} />
          </div>

          {/* Right Column - Product Details */}
          <div className="space-y-8">
            {/* Brand & Model */}
            <div className="border-b border-[#D3C6A3] pb-6">
              <div className="text-[#773D0E] text-lg font-medium tracking-widest uppercase mb-2">
                {brandName}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-[#1A1A1A] mb-3">
                {product.watch.model || "Unknown Model"}
              </h1>
              <p className="text-[#244B5A] text-sm">
                Reference: {product.watch.reference || "N/A"}
              </p>
            </div>

            {/* Price */}
            <div className="bg-white border border-[#D3C6A3] rounded-lg p-6 shadow-sm">
              <div className="text-[#244B5A] text-md mb-1">Price</div>
              <div className="text-4xl font-bold text-[#1A1A1A]">
                {/* {formattedPrice} */}
              </div>
              <div className="text-[#5E561C] text-xs mt-2">
                Including {product.watch.vat || 0}% VAT
              </div>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-xl font-semibold text-[#1A1A1A] mb-3">
                Description
              </h2>
              <p className="text-[#244B5A] leading-relaxed">
                {product.description ||
                  "No description available for this watch."}
              </p>
            </div>

            {/* Specifications Grid */}
            <div>
              <h2 className="text-xl font-semibold text-[#1A1A1A] mb-4">
                Specifications
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <SpecItem
                  icon={<Gauge size={18} />}
                  label="Size"
                  value={product.watch.size || "Not specified"}
                />
                <SpecItem
                  icon={<Clock size={18} />}
                  label="Movement"
                  value={product.watch.movement || "Not specified"}
                />
                <SpecItem
                  icon={<Calendar size={18} />}
                  label="Year"
                  value={product.watch.year.toString() || "Not specified"}
                />
                <SpecItem
                  label="Glass"
                  value={product.watch.glassType || "Not specified"}
                />
                <SpecItem
                  label="Dial Color"
                  value={product.watch.dialColor || "Not specified"}
                />
                <SpecItem
                  label="Bracelet"
                  value={
                    `${product.watch.braceletType} (${product.watch.braceletColor})` ||
                    "Not specified"
                  }
                />
                <SpecItem
                  label="Condition"
                  value={`${product.watch.condition}/10` || "Not specified"}
                />
              </div>
            </div>

            {/* Included Items */}
            <div className="bg-white border border-[#D3C6A3] rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4 flex items-center gap-2">
                <Package size={20} className="text-[#773D0E]" />
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
                  <Shield size={20} />
                  Limited Edition
                </div>
              </div>
            )}

            {/* Stock Status */}
            <div className="flex items-center gap-2 text-sm">
              {product.stock > 0 ? (
                <>
                  <div className="w-2 h-2 bg-[#2D4330] rounded-full animate-pulse"></div>
                  <span className="text-[#2D4330] font-medium">
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
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <AddToCartButton
                product={product}
                className="hover:cursor-pointer h-12 flex-1 bg-[#1A1A1A] hover:bg-[#244B5A] text-white font-bold py-4 px-8 rounded-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              />

              <Button
                onClick={() => handleContactClick()}
                className="hover:cursor-pointer h-12 flex-1 bg-white hover:bg-[#F5F3EE] text-[#1A1A1A] font-semibold py-4 px-8 rounded-lg border-2 border-[#D3C6A3] transition-all"
              >
                Contact
              </Button>
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
    <div className="bg-white border border-[#D3C6A3] rounded-lg p-3 shadow-sm">
      <div className="flex items-center gap-2 text-[#5E561C] text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-[#1A1A1A] font-medium">{value}</div>
    </div>
  );
}

function IncludedItem({ included, text }: { included: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
          included
            ? "bg-[#2D4330]/20 text-[#2D4330]"
            : "bg-[#D3C6A3] text-[#5E561C]"
        }`}
      >
        {included && <Check size={14} />}
      </div>
      <span
        className={included ? "text-[#244B5A]" : "text-[#5E561C] line-through"}
      >
        {text}
      </span>
    </div>
  );
}

function TrustBadge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="text-[#773D0E]">{icon}</div>
      <span className="text-[#244B5A] text-xs font-medium">{text}</span>
    </div>
  );
}
