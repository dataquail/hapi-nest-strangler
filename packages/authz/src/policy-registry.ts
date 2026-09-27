import { Ok, type Result } from "oxide.ts";

import type { Action, Caller, CheckFailure } from "./config.js";
import type { ResourceName, ResourceTypeFor } from "./resource-resolver-registry.js";

// Registry of policy checks, keyed by (resource, action). A host extends
// `PolicyMap` via declaration merging, and its composition root folds the
// per-module contributions into a single registry.
export interface PolicyMap {}

export type PolicyResource = keyof PolicyMap;
export type ActionFor<R extends PolicyResource> = keyof PolicyMap[R] & Action;

/**
 * Checks on a scoped resource receive the resolved resource; checks on an
 * unscoped resource only see the current user. Both are fully closed: a module
 * needing cross-module data closes over its own ACL port at registration.
 */
export type ResourceCheck<Resource> = (
  caller: Caller,
  resource: Resource,
) => Promise<Result<boolean, CheckFailure>>;

export type UnscopedCheck = (caller: Caller) => Promise<Result<boolean, CheckFailure>>;

export type CheckFor<R extends PolicyResource> = R extends ResourceName
  ? ResourceCheck<ResourceTypeFor<R>>
  : UnscopedCheck;

/** An array is AND-composed; wrap with `Check.any(...)` for OR. */
export type CheckOrArray<R extends PolicyResource> = CheckFor<R> | ReadonlyArray<CheckFor<R>>;

export type PolicyContribution = {
  readonly [R in PolicyResource]?: {
    readonly [A in ActionFor<R>]?: CheckOrArray<R>;
  };
};

type AnyRegisteredCheck = (
  caller: Caller,
  resource?: unknown,
) => Promise<Result<boolean, CheckFailure>>;

export type PolicyRegistry = {
  readonly get: <R extends PolicyResource, A extends ActionFor<R>>(
    resource: R,
    action: A,
  ) => AnyRegisteredCheck | undefined;
};

const composeAnd =
  (checks: ReadonlyArray<AnyRegisteredCheck>): AnyRegisteredCheck =>
  async (caller, resource) => {
    for (const check of checks) {
      const allowed = await check(caller, resource);
      if (allowed.isErr()) return allowed;
      if (!allowed.unwrap()) return Ok(false);
    }
    return Ok(true);
  };

export const makePolicyRegistry = (
  contributions: ReadonlyArray<PolicyContribution>,
): PolicyRegistry => {
  const flat = new Map<string, AnyRegisteredCheck>();
  for (const contribution of contributions) {
    for (const [resource, actions] of Object.entries(contribution)) {
      for (const [action, value] of Object.entries(actions as Record<string, unknown>)) {
        const key = `${resource}.${action}`;
        if (flat.has(key)) {
          throw new Error(`PolicyRegistry: duplicate policy for "${key}"`);
        }
        flat.set(
          key,
          Array.isArray(value)
            ? composeAnd(value as ReadonlyArray<AnyRegisteredCheck>)
            : (value as AnyRegisteredCheck),
        );
      }
    }
  }
  return {
    get: (resource, action) => flat.get(`${String(resource)}.${String(action)}`),
  };
};
