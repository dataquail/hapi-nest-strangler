import { deepStrictEqual, throws } from "node:assert";

import { describe, it, vi } from "vitest";

import { fromTodoOrganization } from "./todo-access";

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
