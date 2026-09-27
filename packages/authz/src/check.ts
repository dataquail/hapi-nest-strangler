import { Ok, type Result } from "oxide.ts";

/**
 * A Check is a per-(caller, resource) boolean predicate that may read a store,
 * so it is asynchronous and may fail with the host's transient-store error.
 * Returning boolean (not void + denial) lets policies compose with the OR / AND
 * combinators below before the final lift to the host's denial error happens at
 * the `hasPermissions` boundary.
 */
export type Check<Caller, Resource, E = never> = (
  caller: Caller,
  resource: Resource,
) => Promise<Result<boolean, E>>;

/**
 * A check that inspects only the caller. Declaring the narrower arity lets one
 * such check serve both an unscoped resource, whose checks are handed no
 * resource at all, and a scoped one.
 */
export type CallerCheck<Caller, E = never> = (caller: Caller) => Promise<Result<boolean, E>>;

/** OR semantics. Short-circuits on the first true. With zero checks, returns false — denying by default. */
export const any =
  <Caller, Resource, E = never>(
    ...checks: ReadonlyArray<Check<Caller, Resource, E>>
  ): Check<Caller, Resource, E> =>
  async (caller, resource) => {
    for (const check of checks) {
      const result = await check(caller, resource);
      if (result.isErr()) return result;
      if (result.unwrap()) return Ok(true);
    }
    return Ok(false);
  };

/** AND semantics. Short-circuits on the first false. With zero checks, returns true (vacuously). */
export const all =
  <Caller, Resource, E = never>(
    ...checks: ReadonlyArray<Check<Caller, Resource, E>>
  ): Check<Caller, Resource, E> =>
  async (caller, resource) => {
    for (const check of checks) {
      const result = await check(caller, resource);
      if (result.isErr()) return result;
      if (!result.unwrap()) return Ok(false);
    }
    return Ok(true);
  };
