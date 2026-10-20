import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone — a self-contained server + pruned node_modules
  // — for the Docker runtime image and the portable zip. Not on Vercel: it
  // packages the app itself, and with this set its build stops with
  // "ENOENT ... .next/next-server.js.nft.json" (VERCEL=1 is set during a
  // Vercel build).
  output: process.env.VERCEL ? undefined : "standalone",
};

export default nextConfig;
