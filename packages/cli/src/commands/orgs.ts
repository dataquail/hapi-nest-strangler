import { Command } from "commander";

import { authedClient, expect, run } from "../internal.js";

const list = new Command("list").action(
  run(async () => {
    const client = await authedClient();
    const orgs = expect(await client.GET("/cli/orgs"));
    if (orgs.length === 0) {
      console.log("(no organizations)");
      return;
    }
    for (const org of orgs) {
      console.log(`${org.id}  ${org.name}${org.isAdmin ? "  (admin)" : ""}`);
    }
  }),
);

export const orgsCommand = new Command("orgs").addCommand(list);
