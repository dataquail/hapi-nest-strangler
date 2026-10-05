import type { NextConfig } from "next";

// Same-origin proxy to the API: the browser only sees the Next origin, so the
// session cookie scopes here and there is no CORS (ADR-0018). The paths a Nest
// module serves go to the Nest server, ahead of the catch-all to the legacy
// API; the list mirrors services/api/upstreams.shared.ts, which the
// server-side client reads (ADR-0035).
const SERVER_INTERNAL_URL = process.env.SERVER_INTERNAL_URL ?? "http://localhost:9000";
const NEST_INTERNAL_URL = process.env.NEST_INTERNAL_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.app.github.dev"],
  async rewrites() {
    return [
      {
        source: "/api/orgs/:orgId/todos/:rest*",
        destination: `${NEST_INTERNAL_URL}/orgs/:orgId/todos/:rest*`,
      },
      {
        source: "/api/cli/orgs/:orgId/todos/:rest*",
        destination: `${NEST_INTERNAL_URL}/cli/orgs/:orgId/todos/:rest*`,
      },
      { source: "/api/:path*", destination: `${SERVER_INTERNAL_URL}/:path*` },
    ];
  },
};

export default nextConfig;
