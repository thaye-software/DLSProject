import { AddBrandDialog } from "@/components/admin/AddBrandDialog";
import { BrandTable } from "@/components/admin/BrandTable";
import { Button } from "@/components/ui/button";
import { BrandModel } from "@/database/types";
import { brandService } from "@/services/brandService";
import { getAllProducts } from "@/services/productService";
import Link from "next/link";

export default async function BrandsPage() {

  const initialBrands = (await brandService.getAllBrands()).data || [];
  const initialProducts = (await getAllProducts()) || [];

  return (
    <div>
      <div className="mb-10 flex gap-4">
        <h1 className="font-bold text-3xl">Brands Page</h1>
      </div>
      <div className="mt-10">
        <BrandTable initialBrands={initialBrands} initialProducts={initialProducts} />
      </div>
    </div>
  );
}
