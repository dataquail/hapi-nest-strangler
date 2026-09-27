import { deepStrictEqual } from "node:assert";

import { sql } from "@org/database";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

import { FindCurrentUserQuery } from "./find-current-user.query.js";

const superAdminId = UserId.parse("11111111-1111-1111-1111-111111111111");
const memberId = UserId.parse("22222222-2222-2222-2222-222222222222");

// Runs the real cross-module chain rather than a stub: the auth query reads its
// PlatformRoles port, whose adapter dispatches the role module's policy query
// through the bus into real SQL. A rename or shape change on that published
// query fails here, which a stubbed unit test cannot see.
describe.sequential("FindCurrentUserHandler (integration)", () => {
  const runtime = useServerTestRuntime(["platform.roles", "user.users"]);

  const seed = async () => {
    const { database } = runtime.server();
    await database.exec(sql.unsafe`
      INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
      VALUES
        (${superAdminId}, 'admin@example.com', 'USA', '1 St', '12345', now(), now()),
        (${memberId}, 'member@example.com', 'USA', '2 St', '12345', now(), now())
    `);
    await database.exec(sql.unsafe`
      INSERT INTO platform.roles (user_id, role, granted_at)
      VALUES (${superAdminId}, 'super_admin', now())
    `);
  };

  it("reports isSuperAdmin for a user holding the platform role", async () => {
    await seed();
    const view = await runtime
      .server()
      .queryBus.execute(new FindCurrentUserQuery({ userId: superAdminId }));
    deepStrictEqual(view.unwrap(), { userId: superAdminId, isSuperAdmin: true });
  });

  it("reports isSuperAdmin false for an ordinary user", async () => {
    await seed();
    const view = await runtime
      .server()
      .queryBus.execute(new FindCurrentUserQuery({ userId: memberId }));
    deepStrictEqual(view.unwrap(), { userId: memberId, isSuperAdmin: false });
  });
});
