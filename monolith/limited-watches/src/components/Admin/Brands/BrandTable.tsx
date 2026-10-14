"use client";

import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { AddBrandDialog } from "@/components/Admin/Brands/AddBrandDialog";
import { EditBrandDialog } from "@/components/Admin/Brands/EditBrandDialog";



export function BrandTable({ initialBrands, initialProducts }: { initialBrands: any[]; initialProducts: any[] }) {
  const [brands, setBrands] = useState(initialBrands);
  const [products, setProducts] = useState(initialProducts);

  const productsForBrand = (brandId: number) => {
    return products.filter(
      (product) => product.watch?.brand.id === brandId
    )
  };
  
  // handle updating state when a brand is created or updated
  function handleUpsertBrand(upserted: any) {
    setBrands(prev => {
      const exists = prev.find(b => b.id === upserted.id);
      if (exists) {
        return prev.map(b => b.id === upserted.id ? upserted : b);
      } else {
        return [...prev, upserted];
      }
    });
  }
  
  return (
    <div>
      <div className="flex justify-end mb-10">
        <AddBrandDialog onCreated={handleUpsertBrand} />
      </div>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Brand</TableHead>
          <TableHead>Products</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {brands.map((brand) => (
          <TableRow key={brand.id}>
            <TableCell className="font-medium">{brand.name}</TableCell>
            <TableCell>{productsForBrand(brand.id)?.length || 0}</TableCell>
            <TableCell className="text-right">
              <EditBrandDialog brand={brand} onUpdated={handleUpsertBrand} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      </Table>
    </div>
  );
}
