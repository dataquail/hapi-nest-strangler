import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "./todo.id.js";
import { TodoRootOps } from "./todo.root-ops.js";
import { TodoSpecifications } from "./todos.specification.js";

const aliceId = TodoId.parse("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.parse("22222222-2222-2222-2222-222222222222");
const orgId = OrganizationId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherOrgId = OrganizationId.parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const buyMilk = TodoRootOps.create({
  id: aliceId,
  organizationId: orgId,
  title: "Buy milk",
  now: new Date(),
});

describe("TodoSpecifications", () => {
  it("withId matches the todo with that id and carries an Eq criteria", () => {
    deepStrictEqual(TodoSpecifications.withId(aliceId)(buyMilk), true);
    deepStrictEqual(TodoSpecifications.withId(bobId)(buyMilk), false);
    deepStrictEqual(TodoSpecifications.withId(aliceId).criteria, {
      _tag: "Eq",
      field: "id",
      value: aliceId,
    });
  });

  it("forOrganization matches the owning org only", () => {
    deepStrictEqual(TodoSpecifications.forOrganization(orgId)(buyMilk), true);
    deepStrictEqual(TodoSpecifications.forOrganization(otherOrgId)(buyMilk), false);
  });
});
