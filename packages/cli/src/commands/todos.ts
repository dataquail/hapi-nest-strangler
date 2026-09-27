import { Command } from "commander";

import { authedClient, expect, resolveOrg, run } from "../internal.js";

type OrgOption = { readonly org?: string };

const withOrg = (command: Command): Command =>
  command.option("-o, --org <orgId>", "Organization id (defaults to the configured org)");

const list = withOrg(new Command("list")).action(
  run(async ({ org }: OrgOption) => {
    const client = await authedClient();
    const orgId = await resolveOrg(org);
    const todos = expect(
      await client.GET("/cli/orgs/{orgId}/todos", { params: { path: { orgId } } }),
    );
    if (todos.length === 0) {
      console.log("(no todos)");
      return;
    }
    for (const todo of todos) {
      console.log(`${todo.completed ? "[x]" : "[ ]"} ${todo.id}  ${todo.title}`);
    }
  }),
);

const create = withOrg(new Command("create"))
  .argument("<title>")
  .action(
    run(async (title: string, { org }: OrgOption) => {
      const client = await authedClient();
      const orgId = await resolveOrg(org);
      const todo = expect(
        await client.POST("/cli/orgs/{orgId}/todos", {
          params: { path: { orgId } },
          body: { title },
        }),
      );
      console.log(`Created ${todo.id}: ${todo.title}`);
    }),
  );

const complete = withOrg(new Command("complete"))
  .argument("<todoId>")
  .action(
    run(async (id: string, { org }: OrgOption) => {
      const client = await authedClient();
      const orgId = await resolveOrg(org);
      const todo = expect(
        await client.POST("/cli/orgs/{orgId}/todos/{id}/complete", {
          params: { path: { orgId, id } },
        }),
      );
      console.log(`Completed ${todo.id}: ${todo.title}`);
    }),
  );

const remove = withOrg(new Command("remove"))
  .argument("<todoId>")
  .action(
    run(async (id: string, { org }: OrgOption) => {
      const client = await authedClient();
      const orgId = await resolveOrg(org);
      expect(
        await client.DELETE("/cli/orgs/{orgId}/todos/{id}", { params: { path: { orgId, id } } }),
      );
      console.log(`Removed ${id}.`);
    }),
  );

export const todosCommand = new Command("todos")
  .addCommand(list)
  .addCommand(create)
  .addCommand(complete)
  .addCommand(remove);
