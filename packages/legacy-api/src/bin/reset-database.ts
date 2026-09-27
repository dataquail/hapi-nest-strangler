import "../../load-env";

import config = require("../../config");
import * as logger from "../lib/logger";
import { assertTestDatabase, resetAndMigrate } from "../lib/migrator";

const isTest = process.argv.includes("--test");
const connection: string = isTest
  ? assertTestDatabase(process.env.DATABASE_URL_TEST)
  : config("/db/connection");

if (!isTest && !process.argv.includes("--force")) {
  logger.error(
    "Refusing to drop the development tables: pass --force to reset a non-test database",
  );
  process.exit(1);
}

resetAndMigrate(connection)
  .then((applied) => {
    logger.info(`Reset public and applied ${applied.length} migration(s)`);
  })
  .catch((error) => {
    logger.error("Reset failed", error);
    process.exit(1);
  });
