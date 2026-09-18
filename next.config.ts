import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.HACKDRAFT_E2E ? ".next-e2e" : ".next",
  // Use the stable compiler API instead of Next's experimental CLI integration.
  experimental: { useTypeScriptCli: false },
};
export default nextConfig;
