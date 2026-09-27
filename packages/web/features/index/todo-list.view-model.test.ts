import { TodosContract } from "@org/contracts/api/Contracts";
import { OrganizationId } from "@org/contracts/EntityIds";
import { describe, expect, it } from "vitest";

import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";
import { todosHandlers } from "@/test/handlers/todos";
import { server } from "@/test/msw-server";
import { makeTestQueryClient, renderViewModel } from "@/test/query-harness";
import { ok, typedHandler } from "@/test/typed-handler";

import { useTodoListViewModel } from "./todo-list.view-model";

const OTHER_ORG_ID = OrganizationId.parse("55555555-5555-5555-5555-555555555555");

describe("todo list ViewModel", () => {
  it("fetches the org's todos", async () => {
    server.use(todosHandlers.list([makeTodo({ title: "Buy milk" })]));

    const harness = renderViewModel(() => useTodoListViewModel(TEST_ORG_ID));
    const view = await harness.settle(() => true);

    expect(view.todos.map((todo) => todo.title)).toEqual(["Buy milk"]);
    expect(view.isEmpty).toBe(false);
  });

  it("reports emptiness once an empty page has arrived", async () => {
    server.use(todosHandlers.list([]));

    const harness = renderViewModel(() => useTodoListViewModel(TEST_ORG_ID));
    const view = await harness.settle(() => true);

    expect(view.isEmpty).toBe(true);
  });

  it("scopes the query to the org, so two orgs do not share one slot", async () => {
    const requestedOrgs: Array<string> = [];
    server.use(
      typedHandler(TodosContract.Group.routes.get, ({ path }) => {
        requestedOrgs.push(path.orgId);
        return ok([makeTodo({ title: path.orgId })]);
      }),
    );

    const client = makeTestQueryClient();
    const mine = await renderViewModel(() => useTodoListViewModel(TEST_ORG_ID), client).settle(
      () => true,
    );
    const theirs = await renderViewModel(() => useTodoListViewModel(OTHER_ORG_ID), client).settle(
      () => true,
    );

    expect(requestedOrgs).toEqual([TEST_ORG_ID, OTHER_ORG_ID]);
    expect(mine.todos[0]?.title).toBe(TEST_ORG_ID);
    expect(theirs.todos[0]?.title).toBe(OTHER_ORG_ID);
  });
});
