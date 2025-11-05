import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Brand } from "@/services/brandService";

export default function BrandSelect() {
  const [brands, setBrands] = useState<Array<Brand>>([]);

  async function fetchBrands() {
    try {
      const res = await fetch("/api/brands");
      if (!res.ok) {
        throw new Error("Failed to fetch brands");
      }
      const data = await res.json();
      setBrands(data);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    fetchBrands();
  }, []);

  return (
    <Select>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a brand" />
      </SelectTrigger>
      <SelectContent>
        {brands.map((brand) => (
          <SelectItem key={brand.id} value={brand.id.toString()}>
            {brand.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}