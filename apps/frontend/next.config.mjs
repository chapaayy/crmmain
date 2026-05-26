const internalApiUrl = (
  process.env.INTERNAL_API_URL ||
  process.env.API_INTERNAL_URL ||
  (process.env.NODE_ENV === "production" ? "http://backend:3001" : "http://localhost:3001")
).replace(/\/$/, "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${internalApiUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
