import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // HEIC decoding loads a WASM build that must stay external to the bundler.
  serverExternalPackages: ["heic-convert", "heic-decode"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "maps.googleapis.com",
        pathname: "/maps/api/streetview",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/login",
        destination: "/sign-in",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
