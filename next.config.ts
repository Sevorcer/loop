import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // HEIC decoding and Tesseract load WASM / traineddata that must stay external.
  serverExternalPackages: ["heic-convert", "heic-decode", "tesseract.js", "tesseract.js-core"],
  outputFileTracingIncludes: {
    "/api/jobs/[id]/nameplate": [
      "./node_modules/tesseract.js/**/*",
      "./node_modules/tesseract.js-core/**/*",
      "./node_modules/@tesseract.js-data/eng/**/*",
      "./node_modules/heic-convert/**/*",
      "./node_modules/heic-decode/**/*",
    ],
  },
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
