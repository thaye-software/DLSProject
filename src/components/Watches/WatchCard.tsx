import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

import { Product } from "@/app/watches/type";
import { convertPrice } from "@/services/currencyService";
import AddToCartButton from "./BuyButton";


export function WatchCard({ product, countryCode }: { product: Product, countryCode: string }) {
    
  const formatedPrice = convertPrice(product.priceDkk, countryCode);
  
  
    return (
        
            <Card className="group overflow-hidden transition-all duration-300 hover:shadow-2xl border-0 p-0">
                <Link href={`/watches/view/${product.watch.slug}`}>
                    <CardHeader className="p-0">
                        <div className="relative overflow-hidden aspect-4/5 bg-muted">
                            <Image
                                src={product.productImages[0]?.imageUrl || "/sadly-no-image.png"}
                                alt={`${product.watch.brand.name} ${product.name}`}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                fill
                                unoptimized // REMOVE THIS IN PRODUCTION
                            />

                            <div className="absolute top-4 right-4 flex gap-2">
                                {product.stock > 0 ? (
                                    <Badge variant="secondary" className="bg-background/95 backdrop-blur-sm shadow-lg">
                                        In Stock
                                    </Badge>
                                ): 
                                    <Badge variant="secondary" className="bg-background/95 backdrop-blur-sm shadow-lg">
                                        Sold out
                                    </Badge>}
                            </div>
                        </div>
                    </CardHeader>
                </Link> 
            
                <CardContent className="p-6 flex flex-col justify-between h-full">
                    <div className="space-y-2">
                        {/* Brand + Model */}
                            <p className="text-xs text-muted-foreground font-semibold tracking-[0.2em] uppercase line-clamp-1">
                        {product.watch.brand.name} - {product.watch.model}
                        </p>

                        {/* Watch Name */}
                            <h3 className="text-2xl font-semibold mt-1 line-clamp-1">
                        {product.name}
                        </h3>

                        {/* Description */}
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-12">
                            {product.description}
                        </p>
                    </div>

                    {/* Price + Button */}
                    <div className="flex items-center justify-between gap-4 pt-2 mt-auto">
                        <p className="text-3xl font-bold">
                            {formatedPrice}
                        </p>

                        <div className="overflow-hidden">
                            <AddToCartButton 
                                product={product}
                                className="hover:cursor-pointer opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-700 ease-out whitespace-nowrap"

                            />
                        </div>
                    </div>
                </CardContent>
            </Card>
           
  );
};