import { MetadataRoute } from "next";
import { baseUrl } from "@/lib/utils/client/utils";

export default function sitemap(): MetadataRoute.Sitemap {
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
  ];
}
