"use client"

import { Button } from "../ui/button";

import { Product } from "@/app/watches/type";
import Link from "next/link";

export default function AddToCartButton({product, className}: {product: Product, className: string}) {
  return(
    <div>
      { product.stock > 0 ? (
        <Link href={"/orders/info"}>
          <Button className={className}>
            Buy
          </Button>
        </Link>
        ) : 
        <Button>
          Notify When Available TODO 
        </Button>
      }
    </div>
  );
}
