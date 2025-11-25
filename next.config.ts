import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["openai"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rfwhtalljicdfwafcrto.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "xzrqndztwcpdqaimsmam.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@supabase/storage-js": "@supabase/storage-js/dist/main/index.js",
    };
    return config;
  },
};

export default nextConfig;
