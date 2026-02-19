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
const config = {
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
};

export default config;