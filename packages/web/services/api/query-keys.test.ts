import { OrganizationId } from "@org/contracts/EntityIds";
import { describe, expect, it } from "vitest";

import { queryKeys } from "./query-keys";

const orgId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");

describe("queryKeys", () => {
  it("nests every list key under its feature root, so invalidating the root reaches it", () => {
    expect(queryKeys.users.list({ page: 1, pageSize: 10 }).slice(0, 1)).toEqual(
      queryKeys.users.all,
    );
    expect(queryKeys.todos.list(orgId).slice(0, 1)).toEqual(queryKeys.todos.all);
    expect(queryKeys.organizationMembers.list(orgId).slice(0, 1)).toEqual(
      queryKeys.organizationMembers.all,
    );
    expect(queryKeys.billing.current(orgId).slice(0, 1)).toEqual(queryKeys.billing.all);
  });

  it("keys two orgs apart", () => {
    const other = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
    expect(queryKeys.todos.list(orgId)).not.toEqual(queryKeys.todos.list(other));
  });
});
