export { type AuthzAdapter, type HasPermissions, makeHasPermissions } from "./authz.js";
export * as Check from "./check.js";
export { type CallerCheck } from "./check.js";
export {
  type Action,
  type AuthzConfig,
  type Caller,
  type CheckFailure,
  type ResourceMissing,
} from "./config.js";
export {
  type ActionFor,
  type CheckFor,
  type CheckOrArray,
  makePolicyRegistry,
  type PolicyContribution,
  type PolicyMap,
  type PolicyRegistry,
  type PolicyResource,
  type ResourceCheck,
  type UnscopedCheck,
} from "./policy-registry.js";
export {
  type IdFor,
  makeResourceResolverRegistry,
  type NotFoundFor,
  type Resolver,
  type ResourceName,
  type ResourceResolverMap,
  type ResourceResolverRegistry,
  type ResourceTypeFor,
} from "./resource-resolver-registry.js";
