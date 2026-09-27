#!/usr/bin/env node
import { Command } from "commander";

import { authCommand } from "./commands/auth.js";
import { configCommand } from "./commands/config.js";
import { orgsCommand } from "./commands/orgs.js";
import { todosCommand } from "./commands/todos.js";
import { CliError } from "./internal.js";

const program = new Command("org")
  .version("0.0.0")
  .addCommand(authCommand)
  .addCommand(orgsCommand)
  .addCommand(todosCommand)
  .addCommand(configCommand);

// Commands funnel fatal failures to CliError: one clean line, non-zero exit, no stack dump.
program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof CliError ? error.message : String(error));
  process.exitCode = 1;
});
