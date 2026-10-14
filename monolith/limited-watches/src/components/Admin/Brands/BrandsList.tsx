import { BrandModel } from "@/database/types";
import { getAllBrands } from "@/services/brandService";

export default async function BrandsList() {

  // hmm 1
  async function getBrands() {
    return (await getAllBrands()) || [];
  }
  // hmm 2 lul
  const brands = await getBrands();

  return (
    <div>
      {brands.length > 0 ? (
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
      ) : (
        <h1 className="text-center font-bold text-2xl">No brands found</h1>
      )}
      
    </div>
  );
}
