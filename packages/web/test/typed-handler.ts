// Typed MSW handler wrapper. A test describes an endpoint by its contract route,
// not by a URL string, so contract drift is a `tsc` error. The resolver
// receives decoded path params, query and body and replies with either the
// route's success value or one of its declared errors.

import * as HttpErrors from "@org/contracts/HttpErrors";
import type {
  BodyOf,
  ErrorDefinition,
  ParamsOf,
  QueryOf,
  RouteDefinition,
  SuccessOf,
} from "@org/contracts/Route";
import { http, type HttpHandler, HttpResponse, type JsonBodyType } from "msw";
import type { z } from "zod";

/** Absolute base handlers register under: node's fetch needs an absolute URL. */
export const TEST_API_BASE = "http://localhost/api";

// A fixture is readonly through and through; the wire does not care.
type DeepReadonly<T> =
  T extends ReadonlyArray<infer E>
    ? ReadonlyArray<DeepReadonly<E>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type Reply<R extends RouteDefinition> =
  | { readonly kind: "success"; readonly value: DeepReadonly<SuccessOf<R>> }
  | { readonly kind: "error"; readonly status: number; readonly body: JsonBodyType };

/** The route's success value. Typed by the value so the route's own `Reply` checks it at the resolver. */
export const ok = <A>(value: A): { readonly kind: "success"; readonly value: A } => ({
  kind: "success",
  value,
});

/** One of the route's declared errors, encoded as the server's problem filter would. */
export const fail = <D extends ErrorDefinition>(
  definition: D,
  body: Omit<z.input<D["schema"]>, "_tag">,
): Reply<never> => ({
  kind: "error",
  status: definition.status,
  body: { _tag: definition.tag, ...body } as JsonBodyType,
});

export type ResolverInput<R extends RouteDefinition> = {
  readonly path: ParamsOf<R>;
  readonly urlParams: QueryOf<R>;
  readonly payload: BodyOf<R>;
  readonly request: Request;
};

type Resolver<R extends RouteDefinition> = (
  input: ResolverInput<R>,
) => Reply<R> | Promise<Reply<R>>;

const methodToHandler = {
  get: http.get,
  post: http.post,
  put: http.put,
  patch: http.patch,
  delete: http.delete,
} as const;

// OpenAPI `{orgId}` → MSW `:orgId`.
const toMswPath = (path: string): string => path.replace(/\{([^}]+)\}/g, ":$1");

const queryToRecord = (params: URLSearchParams): Record<string, string> => {
  const out: Record<string, string> = {};
  params.forEach((value, key) => {
    out[key] = value;
  });
  return out;
};

const decode = <S extends z.ZodType | undefined>(schema: S, input: unknown): unknown =>
  schema === undefined ? undefined : schema.parse(input);

export const typedHandler = <R extends RouteDefinition>(
  route: R,
  resolver: Resolver<R>,
): HttpHandler => {
  const verb = methodToHandler[route.method];
  return verb(`${TEST_API_BASE}${toMswPath(route.path)}`, async ({ params, request }) => {
    const url = new URL(request.url);
    const path = decode(route.params, params) as ParamsOf<R>;
    const urlParams = decode(route.query, queryToRecord(url.searchParams)) as QueryOf<R>;
    const payload = decode(route.body, await request.json().catch(() => ({}))) as BodyOf<R>;
    const reply = await resolver({ path, urlParams, payload, request });
    if (reply.kind === "error") return HttpResponse.json(reply.body, { status: reply.status });
    return route.success.schema === undefined
      ? new HttpResponse(null, { status: route.success.status })
      : HttpResponse.json(reply.value as JsonBodyType, { status: route.success.status });
  });
};

/** A bare 401, the shape the auth guard writes. */
export const unauthorized = (): Reply<never> =>
  fail(HttpErrors.Unauthorized, { message: "Not authenticated." });
