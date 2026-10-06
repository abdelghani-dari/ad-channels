import type { NextConfig } from "next";

const isolationHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@vidstack/react"],
  async headers() {
    return [
      {
        // Keep strict isolation ONLY for WASM/ferrite assets that need SharedArrayBuffer
        source: "/ferrite/:path*",
        headers: [
          ...isolationHeaders,
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
