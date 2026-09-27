import * as Glue from "@hapi/glue";

import config = require("./config");
import manifest = require("./manifest");
import * as logger from "./src/lib/logger";

const options = {
  relativeTo: `${__dirname}/src`,
};

const startServer = async function () {
  try {
    const server = await Glue.compose(manifest, options);
    await server.start();

    logger.info(`Server running at: ${server.info.uri}`);
    logger.info(`Environment: ${config("/env")}`);
  } catch (error) {
    logger.error("Server failed to start", error);
    process.exit(1);
  }
};

void startServer();
