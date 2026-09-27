import { afterAll, beforeAll, beforeEach } from "vitest";

import { truncate } from "./test-database.js";
import { startTestServer, type TestServer } from "./test-server.js";

export type ServerTestRuntime = { readonly server: () => TestServer };

/** Boots the test server once per describe block and truncates the named tables before each test. */
export const useServerTestRuntime = (truncateTables: ReadonlyArray<string>): ServerTestRuntime => {
  let server: TestServer | undefined;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server?.close();
  });

  beforeEach(async () => {
    if (server === undefined) throw new Error("test server not started");
    await truncate(server.database, ...truncateTables);
  });

  return {
    server: () => {
      if (server === undefined) throw new Error("test server not started");
      return server;
    },
  };
};
