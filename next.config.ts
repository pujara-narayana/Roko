import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin dev resources by default. When the app is
  // opened via the LAN / Tailscale Network URL (not localhost), the client
  // bundles + HMR are blocked, React never hydrates, and every button goes
  // dead while the SSR HTML still renders. Allow the dev origins we use.
  allowedDevOrigins: ['100.68.91.17', '*.ts.net', '192.168.*.*'],
};

export default nextConfig;
