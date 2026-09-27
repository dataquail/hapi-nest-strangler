import type { Result } from "oxide.ts";

import type { CheckFailure, ResourceMissing } from "./config.js";

// A host contributes entries via declaration merging; this empty declaration is
// the seam it extends. Registration here is also the switch that decides
// whether a resource takes an id at all: scopedness is a property of the
// resource, not of the action.
export interface ResourceResolverMap {}

export type ResourceName = keyof ResourceResolverMap;

export type IdFor<R extends ResourceName> = ResourceResolverMap[R] extends { idType: infer I }
  ? I
  : never;

export type ResourceTypeFor<R extends ResourceName> = ResourceResolverMap[R] extends {
  resourceType: infer T;
}
  ? T
  : never;

/**
 * A resource declares whether resolving it can report absence. An "echo"
 * resolver with nothing to load declares `notFound: never`, which removes the
 * missing-resource error from every call site's error channel.
 */
export type NotFoundFor<R extends ResourceName> = ResourceResolverMap[R] extends {
  notFound: infer N;
}
  ? N
  : ResourceMissing;

export type Resolver<R extends ResourceName> = (
  id: IdFor<R>,
) => Promise<Result<ResourceTypeFor<R>, NotFoundFor<R> | CheckFailure>>;

type ResolversObject = { [R in ResourceName]: Resolver<R> };

export type ResourceResolverRegistry = {
  readonly resolve: <R extends ResourceName>(
    resource: R,
    id: IdFor<R>,
  ) => Promise<Result<ResourceTypeFor<R>, NotFoundFor<R> | CheckFailure>>;
};

export const makeResourceResolverRegistry = (
  resolvers: Partial<ResolversObject>,
): ResourceResolverRegistry => ({
  resolve: <R extends ResourceName>(resource: R, id: IdFor<R>) => {
    const resolver = resolvers[resource];
    if (resolver === undefined) {
      throw new Error(
        `ResourceResolverRegistry: no resolver registered for resource "${String(resource)}"`,
      );
    }
    return resolver(id);
  },
});
