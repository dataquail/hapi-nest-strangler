import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { asOrganizationAdmin, fromOwnOrganization } from "./organization-access";

const userIn = (memberOf: string[], adminOf: string[]) => ({
  isMemberOf: (id: string) => memberOf.includes(id),
  isAdminOf: (id: string) => adminOf.includes(id),
});

const org = (id: string) => ({ get: (key: string) => (key === "id" ? id : undefined) });

const ask = (assertion: any, user: unknown, resource: unknown) =>
  new Promise<boolean | "next">((resolve) => {
    assertion(
      null,
      user,
      resource,
      "x",
      (_err: unknown, allowed: boolean) => {
        resolve(allowed);
      },
      () => {
        resolve("next");
      },
    );
  });

describe("organization access assertions", () => {
  it("fromOwnOrganization admits a member and falls through for a stranger", async () => {
    deepStrictEqual(await ask(fromOwnOrganization, userIn(["org-1"], []), org("org-1")), true);
    deepStrictEqual(await ask(fromOwnOrganization, userIn(["org-2"], []), org("org-1")), "next");
  });

  it("asOrganizationAdmin admits an admin and falls through for a plain member", async () => {
    deepStrictEqual(
      await ask(asOrganizationAdmin, userIn(["org-1"], ["org-1"]), org("org-1")),
      true,
    );
    deepStrictEqual(await ask(asOrganizationAdmin, userIn(["org-1"], []), org("org-1")), "next");
  });

  it("falls through to the older rules when the resource is not a row", async () => {
    deepStrictEqual(await ask(fromOwnOrganization, userIn([], []), "organization"), "next");
    deepStrictEqual(await ask(asOrganizationAdmin, userIn([], []), "organization"), "next");
  });
});
