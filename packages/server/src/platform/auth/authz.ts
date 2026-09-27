import { Inject, Injectable } from "@nestjs/common";
import {
  type HasPermissions,
  makeHasPermissions,
  type PolicyRegistry as PolicyRegistryPort,
  type ResourceResolverRegistry as ResourceResolverRegistryPort,
} from "@org/authz";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { CurrentUser } from "@org/contracts/Policy";
import type { PersistenceUnavailable } from "@org/unit-of-work";

import { type HttpProblem, problem } from "@/platform/http/http-problem.js";

import { type Action as AppAction } from "./actions.js";

// The four host types the authz library does not own, declared once. `action`
// is what turns a shared vocabulary into something the compiler holds every
// resource to.
declare module "@org/authz/config" {
  interface AuthzConfig {
    caller: CurrentUser;
    checkFailure: PersistenceUnavailable;
    resourceMissing: HttpProblem<typeof HttpErrors.NotFound>;
    action: AppAction;
  }
}

// The policy vocabulary, re-published from the file that carries the
// augmentation: a module that names a check reaches it through here, so the
// caller and failure types are always the configured ones.
export type {
  CallerCheck,
  CheckFor,
  PolicyContribution,
  Resolver,
  ResourceCheck,
  UnscopedCheck,
} from "@org/authz";
export { Check } from "@org/authz";

export interface PolicyRegistry extends PolicyRegistryPort {}
export abstract class PolicyRegistry {}

export interface ResourceResolverRegistry extends ResourceResolverRegistryPort {}
export abstract class ResourceResolverRegistry {}

export const resourceNotFound = (): HttpProblem<typeof HttpErrors.NotFound> =>
  problem(HttpErrors.NotFound, {});

/** The one function an endpoint calls: `await this.authz.hasPermissions(caller, resource, action, id)`. */
@Injectable()
export class Authz {
  public readonly hasPermissions: HasPermissions<HttpProblem<typeof HttpErrors.Forbidden>>;

  constructor(
    @Inject(PolicyRegistry) policies: PolicyRegistry,
    @Inject(ResourceResolverRegistry) resolvers: ResourceResolverRegistry,
  ) {
    this.hasPermissions = makeHasPermissions({
      policies,
      resolvers,
      forbidden: (message) => problem(HttpErrors.Forbidden, { message }),
    });
  }
}
