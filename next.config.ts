import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    domains: ["example.com", "images.unsplash.com", "unsplash.com"]
  },

};

export default nextConfig;
