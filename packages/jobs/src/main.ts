import { createDatabase } from "@org/database";
import { Cron } from "croner";
import * as dotenv from "dotenv";
import { z } from "zod";

import { purgeExpiredSessions } from "./jobs/purge-expired-sessions.js";

dotenv.config({ path: "../../.env" });

const Env = z.object({
  DATABASE_URL: z.string().min(1),
  ENV: z.enum(["dev", "prod", "staging"]).default("dev"),
});

const main = async (): Promise<void> => {
  const env = Env.parse(process.env);
  const db = await createDatabase({ url: env.DATABASE_URL, ssl: env.ENV === "prod" });

  // A tick's failure is logged, not fatal: the next cron fire gets a fresh attempt.
  const safeRun = async (): Promise<void> => {
    try {
      await purgeExpiredSessions(db);
    } catch (error) {
      console.error("[jobs.purge-expired-sessions] iteration failed", error);
    }
  };

  console.info("[jobs] starting; first run immediate, subsequent runs hourly");
  await safeRun();
  // Hourly at minute 0: the point is keeping the table bounded, not enforcing the TTL.
  const schedule = new Cron("0 * * * *", safeRun);
  const shutdown = async (): Promise<void> => {
    schedule.stop();
    await db.end();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
};

main().catch((error: unknown) => {
  console.error("[jobs] fatal", error);
  process.exit(1);
});
