"use client"

import { Button } from "../ui/button";

import { Product } from "@/app/watches/type";
import Link from "next/link";

export default function BuyButton({product, className}: {product: Product, className: string}) {
  return(
    <div>
      { product.stock > 0 ? (
        <Link href={`/orders/checkout/infomation?product=${product.watch.slug}`}>
          <Button className="h-12 cursor-pointer font-bold py-4 px-20 transition-all">
            Buy
          </Button>
        </Link>
        ) : 
        <Button className="h-12 cursor-pointer font-bold py-4 px-8 transition-all">
          Notify When Available TODO
        </Button>
      }
    </div>
  );
}
