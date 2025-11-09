// "use server"

// import { baseUrl } from "@/lib/utils";
// import { Products } from "@/types/products/products";

// export async function fetchAllProducts() {
//     const res = await fetch(`${baseUrl}/api/products`);
//     if (!res.ok) {
//         throw new Error("Failed to fetch products");
//     }

//     const data: Products[] = await res.json();
//     return data;
// }