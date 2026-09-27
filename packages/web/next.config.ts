import type { NextConfig } from "next";

// Same-origin proxy to the Nest server: the browser only sees the Next origin,
// so the session cookie scopes here and there is no CORS (ADR-0018).
const SERVER_INTERNAL_URL = process.env.SERVER_INTERNAL_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.app.github.dev"],
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${SERVER_INTERNAL_URL}/:path*` }];
  },
};

export default nextConfig;
