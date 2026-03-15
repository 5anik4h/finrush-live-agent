import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prevent aggressive caching of HTML pages during rapid-deploy cycles.
  // Static assets (_next/static) are fingerprinted and cache forever by default.
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
        {
          key: "Pragma",
          value: "no-cache",
        },
        {
          key: "Expires",
          value: "0",
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(self), geolocation=()",
        }
      ],
    },
    {
      // Static assets with content hashes can be cached forever
      source: "/_next/static/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
  ],
};

export default withSentryConfig(nextConfig, {
  org: "5akin4h",
  project: "javascript-react",

  // Tunnel Sentry requests through /monitoring to avoid adblockers
  tunnelRoute: "/monitoring",

  // Upload source maps on build so Sentry shows readable stack traces
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },

  // Suppress noisy build output
  silent: !process.env.CI,

  // Automatically instrument React components for performance tracing
  reactComponentAnnotation: { enabled: true },
});
