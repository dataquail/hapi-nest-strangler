import { config as dotenv } from "dotenv";

import { resetAndMigrate } from "../migrator.js";

dotenv({ path: "../../.env", quiet: true });

const variable = process.argv.includes("--test") ? "DATABASE_URL_TEST" : "DATABASE_URL";
const url = process.env[variable];
if (url === undefined || url === "") {
  process.stderr.write(`${variable} is not set\n`);
  process.exit(1);
}
if (!new URL(url).pathname.toLowerCase().includes("test") && !process.argv.includes("--force")) {
  process.stderr.write(
    `Refusing to reset '${new URL(url).pathname}': pass --force to reset a non-test database\n`,
  );
  process.exit(1);
}

const applied = await resetAndMigrate({ url, ssl: false });
process.stdout.write(`Reset and applied ${String(applied.length)} migration(s)\n`);
