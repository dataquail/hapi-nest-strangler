import { deepStrictEqual } from "node:assert";

import { Ok } from "oxide.ts";
import { describe, it } from "vitest";

import type { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { HttpProblem } from "@/platform/http/http-problem.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationResolverEntry } from "./organization.resource-resolver.js";

const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const answering = (answer: unknown): AppQueryBus =>
  ({ execute: () => Promise.resolve(answer) }) as unknown as AppQueryBus;

describe("OrganizationResolverEntry", () => {
  it("resolves the projection and reports absence as NotFound", async () => {
    deepStrictEqual(
      (
        await new OrganizationResolverEntry(answering(Ok({ organizationId }))).resolve(
          organizationId,
        )
      ).unwrap(),
      { organizationId },
    );
    const missing = await new OrganizationResolverEntry(answering(Ok(null))).resolve(
      organizationId,
    );
    deepStrictEqual(missing.unwrapErr() instanceof HttpProblem, true);
  });
});
