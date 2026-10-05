import type { CurrentUser } from "@org/contracts/Policy";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { MEMBER_CALLER_ID, SUPER_ADMIN_CALLER, SUPER_ADMIN_CALLER_ID } from "./fake-auth-guard.js";
import { truncate } from "./test-database.js";
import { seedLegacySuperAdmin, seedLegacyUser } from "./test-legacy-rows.js";
import { startTestServer, type TestServer } from "./test-server.js";

type Options = {
  readonly caller?: CurrentUser;
  // Both deterministic callers as legacy users, the first granted super_admin,
  // so a flow that asks Authz about either finds the rows it needs.
  readonly seedSuperAdminCaller?: boolean;
};

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
    if (options.seedSuperAdminCaller === true) {
      await seedLegacyUser(server.database, SUPER_ADMIN_CALLER_ID);
      await seedLegacyUser(server.database, MEMBER_CALLER_ID);
      await seedLegacySuperAdmin(server.database, SUPER_ADMIN_CALLER_ID);
    }
  });

  return {
    server: () => {
      if (server === undefined) throw new Error("test server not started");
      return server;
    },
  };
};
