import { deepStrictEqual } from "node:assert";

import { Err, Ok } from "oxide.ts";
import { describe, it } from "vitest";

import type { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { HttpProblem } from "@/platform/http/http-problem.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "../domain/todo/todo.id.js";
import { TodoResolverEntry } from "./todo.resource-resolvers.js";

const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const todoId = TodoId.parse("33333333-3333-3333-3333-333333333333");

const answering = (answer: unknown): AppQueryBus =>
  ({ execute: () => Promise.resolve(answer) }) as unknown as AppQueryBus;

describe("TodoResolverEntry", () => {
  it("resolves the todo's organization context", async () => {
    const resolved = await new TodoResolverEntry(answering(Ok({ organizationId }))).resolve({
      organizationId,
      todoId,
    });
    deepStrictEqual(resolved.unwrap(), { organizationId });
  });

  it("reports absence as NotFound", async () => {
    const resolved = await new TodoResolverEntry(answering(Ok(null))).resolve({
      organizationId,
      todoId,
    });
    const error = resolved.unwrapErr();
    deepStrictEqual(error instanceof HttpProblem && error.definition.status === 404, true);
  });

  it("propagates PersistenceUnavailable as a failure, not a defect", async () => {
    const resolved = await new TodoResolverEntry(
      answering(Err(new PersistenceUnavailable({ message: "connection lost" }))),
    ).resolve({ organizationId, todoId });
    deepStrictEqual(resolved.unwrapErr()._tag, "PersistenceUnavailable");
  });
});
