import { describe, expect, it } from "vitest";

import { isServedByNest, upstreamFor } from "./upstreams.shared";

const upstreams = { legacy: "http://legacy:9000", nest: "http://nest:3001" };

describe("upstreams", () => {
  it("sends the todo paths, web and CLI, to the Nest server", () => {
    for (const path of [
      "/orgs/abc/todos",
      "/orgs/abc/todos/123",
      "/cli/orgs/abc/todos",
      "/cli/orgs/abc/todos/123/complete",
    ]) {
      expect(isServedByNest(path), path).toBe(true);
      expect(upstreamFor(path, upstreams)).toBe(upstreams.nest);
    }
  });

  it("sends the billing paths and Stripe's webhook to the Nest server", () => {
    for (const path of [
      "/orgs/abc/billing/subscriptions",
      "/orgs/abc/billing/subscriptions/current",
      "/webhooks/stripe",
    ]) {
      expect(isServedByNest(path), path).toBe(true);
      expect(upstreamFor(path, upstreams)).toBe(upstreams.nest);
    }
  });

  it("sends everything else to the legacy API", () => {
    for (const path of [
      "/orgs",
      "/orgs/abc",
      "/orgs/abc/todosx",
      "/orgs/abc/billingx",
      "/webhooks/other",
      "/users",
      "/auth/me",
      "/cli/orgs",
    ]) {
      expect(isServedByNest(path), path).toBe(false);
      expect(upstreamFor(path, upstreams)).toBe(upstreams.legacy);
    }
  });
});
