import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Recharts pulls a large graph; load chart chunks only on dashboard routes.
  experimental: {
    optimizePackageImports: ["recharts", "lucide-react"],
  },
};

export default nextConfig;
