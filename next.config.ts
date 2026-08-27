import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server + pruned node_modules
  // — so the Docker runtime image doesn't need the full node_modules tree.
  output: "standalone",
};

export default nextConfig;
