// The typed client over the generated OpenAPI paths. Environment-agnostic: the
// server builds one per request with the inbound cookie, the browser one over
// the same-origin proxy.

import type { paths } from "@org/contracts/generated/api";
import createClient, { type Client } from "openapi-fetch";

import { type ApiTransport, getApiTransport } from "./transport.shared";

export type ApiClient = Client<paths>;

export const makeApiClient = (transport: ApiTransport): ApiClient =>
  createClient<paths>({
    baseUrl: transport.baseUrl,
    headers: { ...transport.headers },
    credentials: "include",
  });

let browserClient: { readonly transport: ApiTransport; readonly client: ApiClient } | null = null;

/** The client for the current transport; rebuilt only when the transport changes. */
export const getApiClient = (): ApiClient => {
  const transport = getApiTransport();
  if (browserClient === null || browserClient.transport !== transport) {
    browserClient = { transport, client: makeApiClient(transport) };
  }
  return browserClient.client;
};
