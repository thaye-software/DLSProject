"use client";

import Link from "next/link";
import Image from "next/image";

import { motion } from "framer-motion";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { formatMoney } from "@/lib/money";
import type { ProductListing } from "@/services/searchService";

// watchHref lives in the server-only searchService, so the URL is built here
export function WatchCard({ product, index }: { product: ProductListing; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: (index ?? 0) * 0.07 }}
    >
      <Card className="group bg-transparent overflow-hidden transition-all duration-300 border-0 shadow-none p-0 gap-1">
        <Link href={`/watches/view/${product.product_id}/${product.slug}`}>
          <CardHeader className="p-0">
            <div className="relative overflow-hidden aspect-square rounded-2xl">
              <Image
                src={product.thumbnail_url || "/sadly-no-image.png"}
                alt={`${product.brand_name ?? ""} ${product.name}`}
                className="w-full h-full object-cover rounded-2xl transition-transform duration-700 group-hover:scale-105"
                fill
                unoptimized // REMOVE THIS IN PRODUCTION
              />
            </div>
          </CardHeader>
        </Link>

        <CardContent className="gap-2 flex flex-col justify-between h-full px-3">
          <div>
            <p className="text-xs text-muted-foreground font-semibold tracking-[0.2em] uppercase line-clamp-1">
              {product.brand_name}
            </p>
            <h3 className="text-xl font-bold line-clamp-1">{product.name}</h3>
            {product.reference && (
              <p className="text-sm text-muted-foreground leading-relaxed">ref. {product.reference}</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-auto">
            <p className="text-xl font-bold">{formatMoney(product.price)}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
