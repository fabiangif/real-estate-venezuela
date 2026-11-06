import type { NextConfig } from "next";

const CDN_BASE_URL = process.env.CDN_BASE_URL ?? "https://pub-0396125c6071462aa9f92fbcb727652c.r2.dev";
const cdn = new URL(CDN_BASE_URL);

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{
      protocol: "https",
      hostname: cdn.hostname,
      port: "",
      pathname: "/**",
      search: "",
    }],
  },
};

export default nextConfig;
