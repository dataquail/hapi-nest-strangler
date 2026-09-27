import { config as dotenv } from "dotenv";

import { runMigrations } from "../migrator.js";

dotenv({ path: "../../.env", quiet: true });

const variable = process.argv.includes("--test") ? "DATABASE_URL_TEST" : "DATABASE_URL";
const url = process.env[variable];
if (url === undefined || url === "") {
  process.stderr.write(`${variable} is not set\n`);
  process.exit(1);
}

const applied = await runMigrations({ url, ssl: false });
process.stdout.write(
  applied.length === 0
    ? `No pending migrations (${variable})\n`
    : `Applied ${String(applied.length)} migration(s): ${applied.join(", ")}\n`,
);
