import config = require("./config");

// The knex CLI reads this file; the application reads the same connection
// through src/lib/knex. Migrations and seeds live beside it, unnumbered by
// schema: every table is in `public`.
const knexfile = {
  client: "pg",
  connection: config("/db/connection"),
  migrations: { directory: `${__dirname}/migrations`, extension: "ts" },
  seeds: { directory: `${__dirname}/seeds`, extension: "ts" },
};

export = knexfile;
