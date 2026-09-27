import knex from "knex";

import config = require("../../config");

const instance = knex({
  client: "pg",
  connection: config("/db/connection"),
  asyncStackTraces: true,
});

const knexFactory = () => instance;
knexFactory["@singleton"] = true;

export = knexFactory;
