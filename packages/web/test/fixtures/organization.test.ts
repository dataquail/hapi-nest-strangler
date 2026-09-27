// Drift gate: each fixture's default output must parse through the contract's
// schema, so a renamed field breaks here before any feature test does.

import { OrganizationContract } from "@org/contracts/api/Contracts";
import { describe, expect, it } from "vitest";

import { makeCreateOrganizationPayload, makeMyOrganization } from "./organization";

describe("organization fixtures", () => {
  it("makeMyOrganization() parses through OrganizationContract.MyOrganization", () => {
    expect(OrganizationContract.MyOrganization.parse(makeMyOrganization())).toBeDefined();
  });

  it("makeMyOrganization() honors overrides", () => {
    expect(makeMyOrganization({ name: "Other" }).name).toBe("Other");
  });

  it("makeCreateOrganizationPayload() parses through its contract", () => {
    expect(
      OrganizationContract.CreateOrganizationPayload.parse(makeCreateOrganizationPayload()),
    ).toBeDefined();
  });
});
