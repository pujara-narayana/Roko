import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 blocks cross-origin dev resources by default. When the app is
  // opened via the LAN / Tailscale Network URL (not localhost), the client
  // bundles + HMR are blocked, React never hydrates, and every button goes
  // dead while the SSR HTML still renders. Allow the dev origins we use.
  allowedDevOrigins: ['100.68.91.17', '*.ts.net', '192.168.*.*'],

  // Keep these heavy, native/asset-bearing packages out of the server bundle so
  // they're required from node_modules at runtime rather than (incorrectly)
  // bundled. Required for Browserbase live retrieval on Vercel.
  serverExternalPackages: ['playwright-core', '@browserbasehq/sdk'],

  // Force-include playwright-core's runtime assets (notably browsers.json, which
  // dependency tracing misses) into the runs route's serverless function. The
  // lazy import already keeps every other route from loading it.
  outputFileTracingIncludes: {
    '/api/runs/**': ['./node_modules/playwright-core/**'],
  },
};

export default nextConfig;
