// The invalidation vocabulary, in one place. A query is keyed under its
// feature's root, and a mutation invalidates the root; a typo here is a missing
// property, not a stale screen.

import type { OrganizationId } from "@org/contracts/EntityIds";

export type UsersListVariables = { readonly page: number; readonly pageSize: number };

export type AdminOrgsVariables = {
  readonly page: number;
  readonly pageSize: number;
  readonly includeDeleted: "true" | "false";
};

export const queryKeys = {
  users: {
    all: ["users"] as const,
    list: (variables: UsersListVariables) => ["users", "list", variables] as const,
  },
  todos: {
    all: ["todos"] as const,
    list: (orgId: OrganizationId) => ["todos", "list", orgId] as const,
  },
  organizations: {
    all: ["organizations"] as const,
    mine: ["organizations", "mine"] as const,
  },
  adminOrganizations: {
    all: ["admin-organizations"] as const,
    list: (variables: AdminOrgsVariables) => ["admin-organizations", "list", variables] as const,
  },
  organizationMembers: {
    all: ["organization-members"] as const,
    list: (orgId: OrganizationId) => ["organization-members", "list", orgId] as const,
  },
  organizationInvitations: {
    all: ["organization-invitations"] as const,
    list: (orgId: OrganizationId) => ["organization-invitations", "list", orgId] as const,
  },
  billing: {
    all: ["billing"] as const,
    current: (orgId: OrganizationId) => ["billing", "current", orgId] as const,
  },
} as const;

export type InvalidationKey = ReadonlyArray<string>;
