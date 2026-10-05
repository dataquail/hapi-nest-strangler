import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { TodoId } from "@/modules/todos/domain/todo/todo.id.js";
import { TodoRootOps } from "@/modules/todos/domain/todo/todo.root-ops.js";
import { TodoSpecifications } from "@/modules/todos/domain/todo/todos.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodosRepositoryFake } from "./todos.repository-fake.js";

const orgA = OrganizationId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const orgB = OrganizationId.parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const id = TodoId.parse("11111111-1111-1111-1111-111111111111");
const todo = TodoRootOps.create({ id, organizationId: orgA, title: "Buy milk", now: new Date() });

describe("TodosRepositoryFake", () => {
  it("reads back what it stored, and only under the owning org", async () => {
    const repo = new TodosRepositoryFake();
    await repo.insertOne(todo);
    deepStrictEqual(
      (
        await repo.findOne(
          Spec.and(TodoSpecifications.withId(id), TodoSpecifications.forOrganization(orgA)),
        )
      ).unwrap(),
      todo,
    );
    deepStrictEqual(
      (
        await repo.findOne(
          Spec.and(TodoSpecifications.withId(id), TodoSpecifications.forOrganization(orgB)),
        )
      ).unwrap(),
      null,
    );
  });

  it("refuses an update or delete through another org", async () => {
    const repo = new TodosRepositoryFake();
    await repo.insertOne(todo);
    deepStrictEqual((await repo.deleteOne(orgB, id)).unwrapErr()._tag, "TodoNotFound");
    deepStrictEqual(
      (await repo.updateOne({ ...todo, organizationId: orgB })).unwrapErr()._tag,
      "TodoNotFound",
    );
    deepStrictEqual((await repo.deleteOne(orgA, id)).isOk(), true);
  });
});
