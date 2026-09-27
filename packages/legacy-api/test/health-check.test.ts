import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, describe, it } from "vitest";

import { getServer } from "./server";

describe("GET /health-check", () => {
  let server: Awaited<ReturnType<typeof getServer>>;

  beforeAll(async () => {
    server = await getServer();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("answers 200 without touching the database", async () => {
    const res = await server.inject({ method: "GET", url: "/health-check" });
    deepStrictEqual(res.statusCode, 200);
    deepStrictEqual(res.payload, "all good");
  });

  it("strips a leading /api the way the web proxy used to send it", async () => {
    const res = await server.inject({ method: "GET", url: "/api/health-check" });
    deepStrictEqual(res.statusCode, 200);
  });
});
