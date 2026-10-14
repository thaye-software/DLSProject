import { MetadataRoute } from "next";
import { baseUrl } from "@/lib/utils/client/utils";
import { getAllProducts } from "@/services/productService";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getAllProducts();

  const productUrls: MetadataRoute.Sitemap = products.map((product) => ({
    url: `${baseUrl}/watches/view/${product.watch.slug}`,
    lastModified: product.createdAt.toISOString(),
    changeFrequency: "yearly",
    priority: 0.8,
  }));

  return [
    {
      url: `${baseUrl}`,
      lastModified: new Date("2025-12-21").toISOString(),
      changeFrequency: "yearly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/watches`,
      lastModified: new Date("2025-12-21").toISOString(),
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/watches/limited`,
      lastModified: new Date("2025-12-21").toISOString(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...productUrls,
  ];
}
