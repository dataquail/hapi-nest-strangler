import { SpanStatusCode, trace } from "@opentelemetry/api";
import { Err, Ok, type Result } from "oxide.ts";

import type { Caller, CheckFailure } from "./config.js";
import type { ActionFor, PolicyRegistry, PolicyResource } from "./policy-registry.js";
import type {
  IdFor,
  NotFoundFor,
  ResourceName,
  ResourceResolverRegistry,
} from "./resource-resolver-registry.js";

// The resource decides whether an id is taken, on every action. A scoped
// resource (registered in `ResourceResolverMap`) requires one and its checks
// receive the loaded resource; an unscoped one forbids it and the missing-
// resource error is absent from the channel. The variadic-tuple shape on the
// last arg gives clearer errors than overloads: a missing id reads "Expected 4
// arguments, but got 3".
type IdArgsFor<R extends PolicyResource> = R extends ResourceName ? [id: IdFor<R>] : [];

type ErrorsFor<R extends PolicyResource, Denied> = R extends ResourceName
  ? Denied | CheckFailure | NotFoundFor<R>
  : Denied | CheckFailure;

export type AuthzAdapter<Denied> = {
  readonly policies: PolicyRegistry;
  readonly resolvers: ResourceResolverRegistry;
  readonly forbidden: (message: string) => Denied;
};

export type HasPermissions<Denied> = <R extends PolicyResource, A extends ActionFor<R>>(
  caller: Caller,
  resource: R,
  action: A,
  ...args: IdArgsFor<R>
) => Promise<Result<void, ErrorsFor<R, Denied>>>;

const tracer = trace.getTracer("@org/authz");

export const makeHasPermissions =
  <Denied>(adapter: AuthzAdapter<Denied>): HasPermissions<Denied> =>
  (caller, resource, action, ...args) =>
    tracer.startActiveSpan(
      `authz.hasPermissions.${String(resource)}.${String(action)}`,
      async (span) => {
        try {
          const check = adapter.policies.get(resource, action);
          if (check === undefined) {
            throw new Error(
              `PolicyRegistry: no policy registered for "${String(resource)}.${String(action)}"`,
            );
          }
          // The variadic tuple erases which branch we are in; the runtime shape is one id or none.
          const scoped = resource as PolicyResource & ResourceName;
          const id = (args as ReadonlyArray<IdFor<typeof scoped> | undefined>)[0];
          let loaded: unknown = undefined;
          if (id !== undefined) {
            const resolved = await adapter.resolvers.resolve(scoped, id);
            if (resolved.isErr()) {
              span.setStatus({ code: SpanStatusCode.ERROR });
              return Err(resolved.unwrapErr()) as never;
            }
            loaded = resolved.unwrap();
          }
          const allowed = await check(caller, loaded);
          if (allowed.isErr()) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            return Err(allowed.unwrapErr()) as never;
          }
          if (!allowed.unwrap()) {
            span.setAttribute("authz.denied", true);
            return Err(
              adapter.forbidden(`Not permitted: ${String(resource)}.${String(action)}`),
            ) as never;
          }
          return Ok(undefined) as never;
        } finally {
          span.end();
        }
      },
    );
