import "./load-env";

import * as Confidence from "@hapipal/confidence";

import * as environmentConfigs from "./config-files";

const resolveEnv = (): string => {
  if (process.env.APP_ENV) return process.env.APP_ENV;
  if (process.env.VITEST || process.env.NODE_ENV === "test") return "test";
  if (process.env.ENV === "prod") return "production";
  return "development";
};

const env = resolveEnv();

const document = {
  $filter: "env",
  $base: environmentConfigs.defaultConfig,
  development: environmentConfigs.developmentConfig,
  test: environmentConfigs.testConfig,
  production: environmentConfigs.productionConfig,
};

const config = function (path?: string, criteria?: Record<string, unknown>) {
  const store = new Confidence.Store();
  store.load(document);
  return store.get(path ?? "/", { ...(criteria ?? {}), env });
};

export = config;
