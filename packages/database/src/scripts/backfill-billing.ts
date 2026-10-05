import { config as dotenv } from "dotenv";

import { backfillBilling } from "../backfill/backfill-billing.js";
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
  const { subscriptions, webhookEvents } = await backfillBilling(db);
  process.stdout.write(
    `Backfilled the billing schema from public (${variable}): ` +
      `subscriptions ${String(subscriptions.upserted)} upserted, ${String(subscriptions.deleted)} deleted; ` +
      `webhook events ${String(webhookEvents.upserted)} upserted, ${String(webhookEvents.deleted)} deleted\n`,
  );
} finally {
  await db.end();
}
