import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { getServerApiClient } from "../api/client.server";
import { prefetchQuery } from "../query/prefetch.server";
import { orgInvitationsQuery, orgMembersQuery } from "./org-members.queries";

export const prefetchOrgMembers = async (orgId: OrganizationId): Promise<void> =>
  prefetchQuery(orgMembersQuery(orgId, await getServerApiClient()));

export const prefetchOrgInvitations = async (orgId: OrganizationId): Promise<void> =>
  prefetchQuery(orgInvitationsQuery(orgId, await getServerApiClient()));
