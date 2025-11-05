import { Brand } from "@/services/brandService";

export default async function BrandsList() {

  const getBrands = async () => {
    try {
      const res = await fetch("http://localhost:3000/api/brands");
      if (!res.ok) {
        throw new Error("Failed to fetch brands");
      }
      return res.json();
    } catch (error) {
      console.error(error);
      return [];
    }
  };
  const brands = await getBrands();
  console.log(brands)

  return (
    <div>
      <br></br>
      <h1>Brands:</h1>
      <br></br>
      <ul>
        {brands.map((brand: Brand) => (
          <li key={brand.id}>{brand.name}</li>
        ))}
      </ul>
    </div>
  );
}
