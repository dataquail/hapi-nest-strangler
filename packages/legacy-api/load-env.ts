import * as dotenv from "dotenv";

// Imported first by config.ts, so every config file reads a populated process.env.
if (process.env.ENV_FILE !== "disabled") {
  dotenv.config({ path: `${__dirname}/../../.env`, quiet: true });
}
