import { config as dotenv } from "dotenv";

import { backfillTodos } from "../backfill/backfill-todos.js";
import { createDatabase } from "../database.js";

dotenv({ path: "../../.env", quiet: true });

const variable = process.argv.includes("--test") ? "DATABASE_URL_TEST" : "DATABASE_URL";
const url = process.env[variable];
if (url === undefined || url === "") {
  process.stderr.write(`${variable} is not set\n`);
  process.exit(1);
}

const db = await createDatabase({ url, ssl: false, maximumPoolSize: 2 });
try {
  const report = await backfillTodos(db);
  process.stdout.write(
    `Backfilled todos.todos from public.todos (${variable}): ` +
      `${String(report.upserted)} upserted, ${String(report.deleted)} deleted\n`,
  );
} finally {
  await db.end();
}
