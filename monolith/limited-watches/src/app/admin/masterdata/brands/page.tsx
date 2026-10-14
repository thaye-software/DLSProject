import { BrandTable } from "@/components/Admin/Brands/BrandTable";
import { getAllBrands } from "@/services/brandService";
import { getAllProducts } from "@/services/productService";

export default async function BrandsPage() {
  const initialBrands = await getAllBrands() || [];
  const initialProducts = await getAllProducts() || [];

  return (
    <div>
      <div className="mb-10 flex gap-4">
        <h1 className="font-bold text-3xl">Brands Page</h1>
      </div>
      <div className="mt-10">
        <BrandTable
          initialBrands={initialBrands}
          initialProducts={initialProducts}
        />
      </div>
    </div>
  );
}
