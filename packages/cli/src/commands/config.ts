import { saveDefaultOrg } from "@org/api-client";
import { Command } from "commander";

import { run } from "../internal.js";

const setOrg = new Command("set-org").argument("<orgId>").action(
  run(async (orgId: string) => {
    await saveDefaultOrg(orgId);
    console.log(`Default organization set to ${orgId}.`);
  }),
);

export const configCommand = new Command("config").addCommand(setOrg);
