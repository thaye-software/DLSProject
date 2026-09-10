import { MetadataRoute } from "next";
import { baseUrl } from "@/lib/utils/client/utils";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/watches", "/watches/limited", "/watches/:brandName"],
      disallow: ["/admin", "/api/", "/actions", "auth", "/fonts", "/orders", "/privacy", "/settings", "/terms"]
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}