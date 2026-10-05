import Boom from "@hapi/boom";
import type { Lifecycle, Request, ResponseToolkit } from "@hapi/hapi";

import config = require("../../../config");

// What the Nest server needs to answer as itself: the caller's own
// credentials, never a service token, and the body as it arrived — with the
// provider's signature over it, for a webhook.
const FORWARDED_HEADERS = [
  "authorization",
  "cookie",
  "content-type",
  "accept",
  "stripe-signature",
] as const;

const forwardedHeaders = (request: Request): Record<string, string> => {
  const headers: Record<string, string> = {};
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers[name];
    if (typeof value === "string") headers[name] = value;
  }
  return headers;
};

// A route handler that hands the request to the Nest server as it arrived —
// same method, path and body — and relays the answer, status and all. This
// server keeps nothing of the operation; the route stays only until the
// web proxy points at the Nest server itself.
export const proxyToNest = (): Lifecycle.Method => async (request: Request, h: ResponseToolkit) => {
  const baseUrl = String(config("/backend/url")).replace(/\/$/, "");
  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" || request.payload === null
      ? undefined
      : (request.payload as Buffer | string);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${request.path}${request.url.search}`, {
      method,
      headers: forwardedHeaders(request),
      body,
    });
  } catch (error) {
    return Boom.badGateway(
      `${method} ${request.path} could not reach the Nest server: ${String(error)}`,
    );
  }
  const text = await response.text();
  const reply = h.response(text === "" ? undefined : text).code(response.status);
  const contentType = response.headers.get("content-type");
  if (contentType) reply.type(contentType);
  return reply;
};

// The options a proxied route takes: the Nest server authenticates and
// validates, so this one parses nothing and checks no session.
export const proxiedRouteOptions = (description: string, hasPayload: boolean) => ({
  tags: ["api"],
  description,
  auth: false as const,
  ...(hasPayload ? { payload: { parse: false as const, output: "data" as const } } : {}),
});
