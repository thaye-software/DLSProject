

import Image from "next/image";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart } from "lucide-react";

import { Product } from "@/app/watches/type";
import { convertPrice } from "@/services/currencyService";
import AddToCartButton from "./AddToCartButton";


export async function WatchCard({ product, countryCode }: { product: Product, countryCode: string }) {

  const formattedPrice = await convertPrice(product.priceDkk, countryCode.toLowerCase());


  return (

            <Card className="group bg-transparent overflow-hidden transition-all duration-300 border-0 shadow-none p-0 gap-1">
                <Link href={`/watches/view/${product.watch.slug}`}>
                    <CardHeader className="p-0">
                        <div className="relative overflow-hidden aspect-square rounded-2xl">
                            <Image
                                src={product.productImages[0]?.imageUrl || "/sadly-no-image.png"}
                                alt={`${product.watch.brand.name} ${product.name}`}
                                className="w-full h-full object-cover rounded-2xl transition-transform duration-700 group-hover:scale-105"
                                fill
                                unoptimized // REMOVE THIS IN PRODUCTION
                            />

            <div className="absolute top-4 right-4 flex gap-2 group">
              <Button size="icon" variant="secondary" className="opacity-0 group-hover:opacity-100 cursor-pointer bg-background/95 shadow-lg">
                <Heart />
              </Button>
              {/* {product.stock > 0 ? (
                  <Badge variant="secondary" className="bg-background/95  shadow-lg">
                      In Stock
                  </Badge>
              ): 
                                    <Badge variant="secondary" className="bg-background/95 shadow-lg">
                                        Sold out
                                    </Badge>} */}
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
                            <h3 className="text-xl font-bold line-clamp-1">
                        {product.name}
                        </h3>

                        {/* Reference */}
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            ref. {product.watch.reference}
                        </p>
                    </div>

                    {/* Price + Button */}
                    <div className="flex items-center justify-between mt-auto">
                        <p className="text-xl font-bold">
                            {formattedPrice}
                        </p>

                        {/* <div className="overflow-hidden">
                            <AddToCartButton 
                                product={product}
                                className="hover:cursor-pointer opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-700 ease-out whitespace-nowrap"

                            />
                        </div> */}
                    </div>
                </CardContent>
            </Card>
           
  );
};