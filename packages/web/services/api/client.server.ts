// The server-side client: talks to the servers directly on their internal
// URLs (not through the /api rewrite, which is for browser traffic) with the
// inbound Cookie forwarded so their session guards see what the browser's
// would. Which server a path goes to is the upstreams table's call, the
// same one the rewrites read.
import "server-only";

import { cookies } from "next/headers";
import * as React from "react";

import { type ApiClient, makeApiClient } from "./client.shared";
import { upstreamFor } from "./upstreams.shared";

const SERVER_INTERNAL_URL = process.env.SERVER_INTERNAL_URL ?? "http://localhost:9000";
const NEST_INTERNAL_URL = process.env.NEST_INTERNAL_URL ?? "http://localhost:3001";

const upstreams = { legacy: SERVER_INTERNAL_URL, nest: NEST_INTERNAL_URL };

// The client is built on the legacy URL; a request for a path the Nest server
// serves is re-addressed before it leaves.
const routedFetch = (request: Request): Promise<Response> => {
  const url = new URL(request.url);
  const upstream = upstreamFor(url.pathname, upstreams);
  return fetch(new Request(`${upstream}${url.pathname}${url.search}`, request));
};

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
    fetch: routedFetch,
  });
});
