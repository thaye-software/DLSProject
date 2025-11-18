import { BrandModel } from "@/database/types";
import { brandService } from "@/services/brandService";

export default async function BrandsList() {

  async function getBrands() {
    return (await brandService.getAllBrands()).data;
  }
  const brands = await getBrands();

  return (
    <div>
      <br></br>
      <h1>Brands:</h1>
      <br></br>
      <ul>
        {brands?.map((brand) => (
          <li key={brand.id}>{brand.name}</li>
        ))}
      </ul>
    </div>
  );
}
