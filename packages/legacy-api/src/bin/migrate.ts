import "../../load-env";

import config = require("../../config");
import * as logger from "../lib/logger";
import { assertTestDatabase, runMigrations } from "../lib/migrator";

const isTest = process.argv.includes("--test");
const connection: string = isTest
  ? assertTestDatabase(process.env.DATABASE_URL_TEST)
  : config("/db/connection");

runMigrations(connection)
  .then((applied) => {
    logger.info(
      `Applied ${applied.length} migration(s)${applied.length ? `: ${applied.join(", ")}` : ""}`,
    );
  })
  .catch((error) => {
    logger.error("Migration failed", error);
    process.exit(1);
  });
