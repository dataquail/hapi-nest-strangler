import type { CurrentUser } from "@org/contracts/Policy";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { SUPER_ADMIN_CALLER } from "./fake-auth-guard.js";
import { truncate } from "./test-database.js";
import { startTestServer, type TestServer } from "./test-server.js";

type Options = { readonly caller?: CurrentUser };

export type ServerTestRuntime = { readonly server: () => TestServer };

/** Boots the test server once per describe block and truncates the named tables before each test. */
export const useServerTestRuntime = (
  truncateTables: ReadonlyArray<string>,
  options: Options = {},
): ServerTestRuntime => {
  let server: TestServer | undefined;

  beforeAll(async () => {
    server = await startTestServer(options.caller ?? SUPER_ADMIN_CALLER);
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
