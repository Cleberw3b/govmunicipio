import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: '../..',
  },
  devIndicators: {
    position: 'bottom-right',
  },
};

export default nextConfig;
