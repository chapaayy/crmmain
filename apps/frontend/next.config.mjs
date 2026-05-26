const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");
const internalApiUrl = (process.env.INTERNAL_API_URL || process.env.API_INTERNAL_URL || "http://backend:3001").replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    if (!apiUrl) {
      return [];
    }

    const destinationBaseUrl = apiUrl === "/api" ? internalApiUrl : apiUrl;

    return [
      {
        source: "/api/:path*",
        destination: `${destinationBaseUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
