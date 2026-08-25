import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/api/webhooks/heygen": ["./node_modules/ffmpeg-static/**/*", "./node_modules/ffprobe-static/**/*",], },
  turbopack: {
    root: __dirname // // force correct project root
  },
  serverExternalPackages: ["fluent-ffmpeg", "ffmpeg-static"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  },
};

export default nextConfig;
