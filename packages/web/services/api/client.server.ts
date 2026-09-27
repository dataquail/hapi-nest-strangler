// The server-side client: talks to the Nest server directly on the internal
// URL (not through the /api rewrite, which is for browser traffic) with the
// inbound Cookie forwarded so its session guard sees what the browser's would.
import "server-only";

import { cookies } from "next/headers";
import * as React from "react";

import { type ApiClient, makeApiClient } from "./client.shared";

const SERVER_INTERNAL_URL = process.env.SERVER_INTERNAL_URL ?? "http://localhost:3001";

// Memoised per request: one client, one cookie capture, and no leakage across requests.
export const getServerApiClient = React.cache(async (): Promise<ApiClient> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
  return makeApiClient({
    baseUrl: SERVER_INTERNAL_URL,
    headers: cookieHeader.length > 0 ? { Cookie: cookieHeader } : {},
  });
});
