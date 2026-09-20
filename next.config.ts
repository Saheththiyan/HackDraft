import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  distDir: process.env.HACKDRAFT_E2E ? ".next-e2e" : ".next",
  // Use the stable compiler API instead of Next's experimental CLI integration.
  experimental: { useTypeScriptCli: false },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ] }];
  },
};
export default nextConfig;
