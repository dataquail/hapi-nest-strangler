import { deepStrictEqual, ok } from "node:assert";

import { sql } from "@org/database";
import { describe, it } from "vitest";
import { z } from "zod";

import { MEMBER_CALLER, MEMBER_CALLER_ID } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const NameRow = z.object({ name: z.string() });
const MemberRow = z.object({ user_id: z.guid() });

describe.sequential("POST /orgs (integration)", () => {
  // Super-admins cannot own orgs, so creation runs as a regular member, who becomes the first member.
  const runtime = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { caller: MEMBER_CALLER, seedSuperAdminCaller: true },
  );

  it("creates an org, returns its id, and seeds the caller as the first Membership", async () => {
    const { client, database } = runtime.server();
    const res = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(res.data !== undefined, JSON.stringify(res.error));
    const { id } = res.data;
    ok(typeof id === "string" && id.length > 0);
    const orgRows = await database.any(
      sql.type(NameRow)`SELECT name FROM "organization".organizations WHERE id = ${id}`,
    );
    deepStrictEqual(
      orgRows.map((r) => r.name),
      ["Acme"],
    );
    const memberRows = await database.any(
      sql.type(
        MemberRow,
      )`SELECT user_id FROM "organization".memberships WHERE organization_id = ${id}`,
    );
    deepStrictEqual(
      memberRows.map((r) => r.user_id),
      [MEMBER_CALLER_ID],
    );
  });
});
