"use client";

import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import { Product } from "@/app/watches/type";
import FavoriteButton from "./FavoriteButton";
import { motion } from "framer-motion";

export function WatchCard({
  product,
  formattedPrice,
  index,
  onFavoriteClick,
}: {
  product: Product;
  formattedPrice: string;
  index?: number;
  onFavoriteClick?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: (index ?? 0) * 0.07 }}
    >
      <Card className="group bg-transparent overflow-hidden transition-all duration-300 border-0 shadow-none p-0 gap-1">
        <Link href={`/watches/view/${product.watch.slug}`}>
          <CardHeader className="p-0">
            <div className="relative overflow-hidden aspect-square rounded-2xl">
              <Image
                src={
                  product.productImages[0]?.imageUrl || "/sadly-no-image.png"
                }
                alt={`${product.watch.brand.name} ${product.name}`}
                className="w-full h-full object-cover rounded-2xl transition-transform duration-700 group-hover:scale-105"
                fill
                unoptimized // REMOVE THIS IN PRODUCTION
              />

              <div className="absolute top-4 right-4 flex gap-2 group">
                <FavoriteButton
                  productId={product.id}
                  onFavoriteClick={onFavoriteClick}
                />
              </div>
            </div>
          </CardHeader>
        </Link>

        <CardContent className="gap-2 flex flex-col justify-between h-full px-3">
          <div className="">
            {/* Brand + Model */}
            <p className="text-xs text-muted-foreground font-semibold tracking-[0.2em] uppercase line-clamp-1">
              {product.watch.brand.name}
            </p>

            {/* Watch Name */}
            <h3 className="text-xl font-bold line-clamp-1">{product.name}</h3>

            {/* Reference */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              ref. {product.watch.reference}
            </p>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between mt-auto">
            <p className="text-xl font-bold">{formattedPrice}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
