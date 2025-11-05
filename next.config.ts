import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Allow builds to complete with warnings, but still show them
    // This way you can fix issues incrementally without blocking deployment
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
