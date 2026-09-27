import { Inject, Injectable } from "@nestjs/common";
import { Err, Ok } from "oxide.ts";

import type { Resolver } from "@/platform/auth/authz.js";
import { resourceNotFound } from "@/platform/auth/authz.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";

import { FindOrganizationByIdQuery } from "../queries/find-organization-by-id.query.js";

@Injectable()
export class OrganizationResolverEntry {
  constructor(@Inject(AppQueryBus) private readonly queries: AppQueryBus) {}

  public readonly resolve: Resolver<"organization"> = async (organizationId) => {
    const found = await this.queries.execute(new FindOrganizationByIdQuery({ organizationId }));
    if (found.isErr()) return found;
    const view = found.unwrap();
    return view === null ? Err(resourceNotFound()) : Ok(view);
  };
}
