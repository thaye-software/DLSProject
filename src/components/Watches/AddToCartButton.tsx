"use client"

import { ShoppingCart } from "lucide-react";

import { Button } from "../ui/button";

import { Product } from "@/app/watches/type";

export default function AddToCartButton({product, className}: {product: Product, className: string}) {
  return(
    <Button className={className} disabled={product.stock === 0}>
      { product.stock > 0 ? (
          <>
            TODO Add <ShoppingCart />
          </>
        ) : 
          "Notify When Available (to be implemented)"
      }
    </Button>
  );
}
