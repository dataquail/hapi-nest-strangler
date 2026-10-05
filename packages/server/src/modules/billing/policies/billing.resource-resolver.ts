import { Injectable } from "@nestjs/common";
import { Ok } from "oxide.ts";

import type { Resolver } from "@/platform/auth/authz.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

// The resource identity IS the org id: nothing to load, and a non-member must
// not learn whether a subscription exists. A deliberate echo resolver.
export type BillingResourceContext = { readonly organizationId: OrganizationId };

declare module "@org/authz/resource-resolver-registry" {
  interface ResourceResolverMap {
    billing: { resourceType: BillingResourceContext; idType: OrganizationId; notFound: never };
  }
}

@Injectable()
export class BillingResolverEntry {
  public readonly resolve: Resolver<"billing"> = (organizationId) =>
    Promise.resolve(Ok({ organizationId }));
}
