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
        source: "/",
        headers: isolationHeaders,
      },
      {
        source: "/:path*",
        headers: isolationHeaders,
      },
      {
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
