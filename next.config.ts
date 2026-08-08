import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // TMDB serves every poster and profile image from this one host.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
    ],
  },
};

export default nextConfig;
