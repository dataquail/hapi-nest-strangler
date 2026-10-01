import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "./todo.id.js";
import { TodoRootOps } from "./todo.root-ops.js";

const todoId = TodoId.parse("33333333-3333-3333-3333-333333333333");
const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const now = new Date("2025-01-01T00:00:00Z");
const later = new Date("2025-02-01T00:00:00Z");

const fresh = () => TodoRootOps.create({ id: todoId, organizationId, title: "Buy milk", now });

describe("TodoRootOps.create", () => {
  it("constructs an incomplete todo with the given id/title/org and timestamps", () => {
    const todo = fresh();
    deepStrictEqual(todo, {
      id: todoId,
      organizationId,
      title: "Buy milk",
      completed: false,
      createdAt: now,
      updatedAt: now,
    });
  });
});

describe("TodoRootOps.update", () => {
  it("replaces title/completed and advances updatedAt, preserving id/org/createdAt", () => {
    const updated = TodoRootOps.update(fresh(), {
      title: "Buy oat milk",
      completed: true,
      now: later,
    });
    deepStrictEqual(updated.title, "Buy oat milk");
    deepStrictEqual(updated.completed, true);
    deepStrictEqual(updated.createdAt, now);
    deepStrictEqual(updated.updatedAt, later);
  });
});

describe("TodoRootOps.complete", () => {
  it("flips completed and re-stamps updatedAt without touching the title", () => {
    const completed = TodoRootOps.complete(fresh(), later);
    deepStrictEqual(completed.completed, true);
    deepStrictEqual(completed.title, "Buy milk");
    deepStrictEqual(completed.updatedAt, later);
  });

  it("is idempotent", () => {
    const twice = TodoRootOps.complete(TodoRootOps.complete(fresh(), now), later);
    deepStrictEqual(twice.completed, true);
    deepStrictEqual(twice.updatedAt, later);
  });

  it("never mutates its input", () => {
    const todo = fresh();
    TodoRootOps.update(todo, { title: "changed", completed: true, now: later });
    TodoRootOps.complete(todo, later);
    deepStrictEqual(todo.title, "Buy milk");
    deepStrictEqual(todo.completed, false);
  });
});
