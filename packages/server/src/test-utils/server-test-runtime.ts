import type { CurrentUser } from "@org/contracts/Policy";
import { sql } from "@org/database";
import { afterAll, beforeAll, beforeEach } from "vitest";

import { MEMBER_CALLER_ID, SUPER_ADMIN_CALLER, SUPER_ADMIN_CALLER_ID } from "./fake-auth-guard.js";
import { truncate } from "./test-database.js";
import { startTestServer, type TestServer } from "./test-server.js";

type Options = {
  readonly caller?: CurrentUser;
  // Inserts both deterministic caller rows plus the super_admin role for the
  // first, so any flow touching memberships or Authz has the users it needs.
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
      await server.database.exec(sql.unsafe`
        INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
        VALUES
          (${SUPER_ADMIN_CALLER_ID}, 'super-admin@test.local', 'USA', '1 St', '00000', now(), now()),
          (${MEMBER_CALLER_ID}, 'member@test.local', 'USA', '2 St', '00000', now(), now())
        ON CONFLICT (id) DO NOTHING
      `);
      await server.database.exec(sql.unsafe`
        INSERT INTO platform.roles (user_id, role)
        VALUES (${SUPER_ADMIN_CALLER_ID}, 'super_admin')
        ON CONFLICT (user_id, role) DO NOTHING
      `);
    }
  });

  return {
    server: () => {
      if (server === undefined) throw new Error("test server not started");
      return server;
    },
  };
};
