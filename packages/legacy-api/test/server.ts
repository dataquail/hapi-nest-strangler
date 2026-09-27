import * as Glue from "@hapi/glue";

import manifest = require("../manifest");

const options = {
  relativeTo: `${__dirname}/../src`,
};

export const getServer = async () => Glue.compose(manifest, options);
