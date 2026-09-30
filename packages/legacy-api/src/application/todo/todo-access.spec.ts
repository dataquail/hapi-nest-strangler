import { deepStrictEqual, throws } from "node:assert";

import Boom from "@hapi/boom";
import { describe, it, vi } from "vitest";

import { fromOwnOrganization, fromTodoOrganization } from "./todo-access";

const todo = { get: (key: string) => (key === "organization_id" ? "org-1" : undefined) };
const userIn = (orgs: string[]) => ({ isMemberOf: (id: string) => orgs.includes(id) });

describe("fromTodoOrganization", () => {
  it("allows a member of the todo's organization and falls through for anyone else", () => {
    const result = vi.fn();
    const next = vi.fn();
    fromTodoOrganization(undefined, userIn(["org-1"]), todo, "edit", result, next);
    deepStrictEqual(result.mock.calls, [[undefined, true]]);
    deepStrictEqual(next.mock.calls.length, 0);

    fromTodoOrganization(undefined, userIn([]), todo, "edit", result, next);
    deepStrictEqual(next.mock.calls.length, 1);
  });

  it("falls through when the ACL hands it a name instead of a row, and rethrows an error", () => {
    const result = vi.fn();
    const next = vi.fn();
    fromTodoOrganization(undefined, userIn(["org-1"]), "todo", "list", result, next);
    deepStrictEqual(result.mock.calls.length, 0);
    deepStrictEqual(next.mock.calls.length, 1);
    throws(() => {
      fromTodoOrganization(new Error("acl"), userIn([]), todo, "edit", result, next);
    });
  });
});

describe("fromOwnOrganization", () => {
  const requestBy = (user: object) =>
    ({ auth: { credentials: { user } }, params: { orgId: { get: () => "org-1" } } }) as any;
  const h = { continue: Symbol("continue") } as any;

  it("continues for a member or a super admin and refuses anyone else", () => {
    const member = { isSuperAdmin: () => false, isMemberOf: (id: string) => id === "org-1" };
    const admin = { isSuperAdmin: () => true, isMemberOf: () => false };
    const stranger = { isSuperAdmin: () => false, isMemberOf: () => false };
    deepStrictEqual(fromOwnOrganization(requestBy(member), h), h.continue);
    deepStrictEqual(fromOwnOrganization(requestBy(admin), h), h.continue);
    const refused = fromOwnOrganization(requestBy(stranger), h);
    deepStrictEqual(Boom.isBoom(refused) && refused.output.statusCode, 403);
  });
});
