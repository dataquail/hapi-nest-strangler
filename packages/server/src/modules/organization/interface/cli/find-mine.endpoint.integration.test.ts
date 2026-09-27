import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "vitest";

import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

describe.sequential("GET /cli/orgs (integration)", () => {
  const runtime = useServerTestRuntime(
    [
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    { caller: MEMBER_CALLER, seedSuperAdminCaller: true },
  );

  it("lists the caller's organizations via the CLI surface", async () => {
    const { client } = runtime.server();
    const created = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(created.data !== undefined, JSON.stringify(created.error));
    const res = await client.GET("/cli/orgs");
    deepStrictEqual(
      res.data?.map((o) => o.id),
      [created.data.id],
    );
    const [first] = res.data ?? [];
    ok(first !== undefined);
    deepStrictEqual(first.name, "Acme");
    // The creator becomes the org admin.
    deepStrictEqual(first.isAdmin, true);
  });
});
