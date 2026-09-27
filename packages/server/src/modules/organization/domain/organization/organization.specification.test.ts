import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationRootOps } from "./organization.root-ops.js";
import { OrganizationSpecifications } from "./organization.specification.js";

const id = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const now = new Date("2025-01-01T00:00:00Z");
const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });

describe("OrganizationSpecifications", () => {
  it("withId matches by id", () => {
    deepStrictEqual(OrganizationSpecifications.withId(id)(organization), true);
  });

  it("isDeleted / notDeleted read deletedAt", () => {
    deepStrictEqual(OrganizationSpecifications.notDeleted(organization), true);
    deepStrictEqual(OrganizationSpecifications.isDeleted(organization), false);
    const deleted = OrganizationRootOps.softDelete(organization, { now }).unwrap().organization;
    deepStrictEqual(OrganizationSpecifications.isDeleted(deleted), true);
    deepStrictEqual(OrganizationSpecifications.isDeleted.criteria, {
      _tag: "IsNotNull",
      field: "deletedAt",
    });
  });
});
