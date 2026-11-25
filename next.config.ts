import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev server binds 0.0.0.0. Allow the laptop URL the README uses.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  async redirects() {
    return [
      { source: "/app/settings", destination: "/settings", permanent: false },
      { source: "/flowers/settings", destination: "/settings", permanent: false },
      { source: "/app", destination: "/flowers", permanent: false },
      { source: "/app/:path*", destination: "/flowers/:path*", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
