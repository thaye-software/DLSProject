import { searchProducts } from "@/services/productService";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query) {
    return new Response("Missing query", { status: 400 });
  }
  const results = await searchProducts(query);

  return new Response(JSON.stringify(results), {
    headers: { "Content-Type": "application/json" },
  });
}
