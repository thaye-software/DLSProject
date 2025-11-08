import Image from "next/image";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";

import { Products } from "@/app/watches/type";
import { currencyService } from "@/services/currencyService";


export const WatchCard = ({ watch }: { watch: Products }) => {

    // to be implemented 
    // get user country and convert price accordingly
    // const countryCode = getUserCountryCode(); // placeholder function
    const countryCode = "DKK";
    const formatedPrice = currencyService.convertPrice(watch.priceDkk, countryCode);

    console.log(watch)
    return (
        <Card className="group overflow-hidden transition-all duration-300 hover:shadow-2xl border-0">
            <CardHeader className="p-0">
                <div className="relative overflow-hidden aspect-[4/5] bg-muted">
                <Image
                    src={watch.productImages[0]?.imageUrl || "/placeholder-image.png"}
                    alt={`${watch.watch.brand.name} ${watch.name}`}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    width={230}
                    height={287}
                />
                    <div className="absolute top-4 right-4 flex gap-2">
                        {watch.stock > 0 && (
                        <Badge variant="secondary" className="bg-background/95 backdrop-blur-sm shadow-lg">
                            In Stock
                        </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
        
            <CardContent className="p-6 flex flex-col justify-between h-full">
                <div className="space-y-2">
                    {/* Brand + Model */}
                        <p className="text-xs text-muted-foreground font-semibold tracking-[0.2em] uppercase line-clamp-1">
                    {watch.watch.brand.name} - {watch.watch.model}
                    </p>

                    {/* Watch Name */}
                        <h3 className="text-2xl font-semibold mt-1 line-clamp-1">
                    {watch.name}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 min-h-[3rem]">
                        {watch.description}
                    </p>
                </div>

                {/* Price + Button */}
                <div className="flex items-center justify-between gap-4 pt-2 mt-auto">
                    <p className="text-3xl font-bold">
                        {formatedPrice}
                    </p>

                    <div className="overflow-hidden">
                        <Button
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all duration-700 ease-out whitespace-nowrap"
                        >
                            <ShoppingCart className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
  );
};