// Server-only: the caller's memberships without going through Suspense. The
// org layout uses it for its membership guard; role gates read it too.
import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as React from "react";

import { unwrap } from "../api/api-error";
import { getServerApiClient } from "../api/client.server";
import type { Schemas } from "../api/types";

export const fetchMyOrgs = React.cache(
  async (): Promise<ReadonlyArray<Schemas["MyOrganization"]>> => {
    const client = await getServerApiClient();
    return unwrap(await client.GET("/orgs"));
  },
);

// The caller's role in one org: "admin" when they hold the admin role, "member"
// when they belong without it, undefined when they are not a member at all.
export const fetchMyOrgRole = async (
  orgId: OrganizationId,
): Promise<"admin" | "member" | undefined> => {
  const org = (await fetchMyOrgs()).find((candidate) => candidate.id === orgId);
  if (org === undefined) return undefined;
  return org.isAdmin ? "admin" : "member";
};
