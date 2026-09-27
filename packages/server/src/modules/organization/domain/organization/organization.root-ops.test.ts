import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationRootOps } from "./organization.root-ops.js";

const id = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const now = new Date("2025-01-01T00:00:00Z");
const later = new Date("2025-02-01T00:00:00Z");

describe("OrganizationRootOps", () => {
  it("create emits OrganizationCreated", () => {
    const { events, organization } = OrganizationRootOps.create({ id, name: "Acme", now });
    deepStrictEqual(organization.deletedAt, null);
    deepStrictEqual(events, [{ _tag: "OrganizationCreated", organizationId: id, name: "Acme" }]);
  });

  it("softDelete stamps deletedAt once and refuses a second time", () => {
    const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
    const deleted = OrganizationRootOps.softDelete(organization, { now: later }).unwrap();
    deepStrictEqual(deleted.organization.deletedAt, later);
    deepStrictEqual(deleted.events[0]?._tag, "OrganizationSoftDeleted");
    deepStrictEqual(
      OrganizationRootOps.softDelete(deleted.organization, { now: later }).unwrapErr()._tag,
      "OrganizationAlreadyDeleted",
    );
  });

  it("restore clears deletedAt and refuses a live organization", () => {
    const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
    deepStrictEqual(
      OrganizationRootOps.restore(organization, { now }).unwrapErr()._tag,
      "OrganizationNotDeleted",
    );
    const deleted = OrganizationRootOps.softDelete(organization, { now: later }).unwrap()
      .organization;
    const restored = OrganizationRootOps.restore(deleted, { now: later }).unwrap();
    deepStrictEqual(restored.organization.deletedAt, null);
    deepStrictEqual(restored.events[0]?._tag, "OrganizationRestored");
  });
});
