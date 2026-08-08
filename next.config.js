/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
let env = { env: {} };
if (process.env.SKIP_ENV_VALIDATION !== "true") {
  try {
    env = await import("./src/env.js");
  } catch (error) {
    // During Docker build, env might not be available
    console.warn("Skipping env validation during build:", error.message);
    env = { env: {} };
  }
}

/** @type {import("next").NextConfig} */
const isDev = process.env.NODE_ENV !== "production";

// Next.js dev/HMR needs 'unsafe-eval'. Without it Telegram WebView loads HTML/JS
// files but React never hydrates → no /api/trpc calls (exactly what we saw in DevTools).
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  "https://telegram.org",
  "https://*.telegram.org",
].join(" ");

const cspHeader = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss: ws:",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self' https://web.telegram.org https://webk.telegram.org https://webz.telegram.org https://*.telegram.org",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const config = {
  // Allow Mini App traffic via local tunnels in `next dev`.
  // Without this, Next can serve HTML but block/break client API calls from tunnel origins.
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.io",
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Skip type checking during build (faster builds, type errors caught in CI)
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        hostname: "core.telegram.org",
      },
      // Only add storage hostname if env is available
      ...(env.env?.STORAGE_PUBLIC_URL
        ? [
            {
              hostname: new URL(env.env.STORAGE_PUBLIC_URL).hostname,
            },
          ]
        : []),
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default config;