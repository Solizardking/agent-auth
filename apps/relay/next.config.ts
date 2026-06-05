import type { NextConfig } from "next";

const config: NextConfig = {
  // Standalone output for Docker/Phala dstack deployment
  output: "standalone",
  experimental: {
    // Required for edge-compatible jose JWT verification in TEE
    serverComponentsExternalPackages: ["jose"],
  },
};

export default config;
