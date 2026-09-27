import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, describe, it } from "vitest";

import { getServer } from "./server";

type ContractRoute = { method: string; path: string };
type ContractGroup = { routes: Record<string, ContractRoute> };

// Param names are the server's own business (`{user}` here, `{id}` in the
// contract); a client fills the template before the request leaves.
const key = (method: string, path: string) =>
  `${method.toUpperCase()} ${path.replace(/\{[^}]+\}/g, "{}")}`;

const routesOf = (groups: readonly ContractGroup[]) =>
  groups.flatMap((group) =>
    Object.values(group.routes).map((route) => key(route.method, route.path)),
  );

const LEGACY_ONLY_ROUTES = ["GET /health-check"];

// The contracts package is ESM and this package is CommonJS; a dynamic import
// is the one form both the compiler and the runtime accept.
const loadContracts = () => import("@org/contracts");

describe("route parity with @org/contracts", () => {
  let server: Awaited<ReturnType<typeof getServer>>;
  let served: string[];
  let contracts: Awaited<ReturnType<typeof loadContracts>>;

  beforeAll(async () => {
    contracts = await loadContracts();
    server = await getServer();
    await server.initialize();
    served = server
      .table()
      .map((route) => key(route.method, route.path))
      .sort();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("serves exactly the domain and CLI routes the contracts declare, plus its health check", () => {
    const expected = [
      ...routesOf(contracts.DomainApi),
      ...routesOf(contracts.CliApi),
      ...LEGACY_ONLY_ROUTES,
    ].sort();
    deepStrictEqual(served, expected);
  });

  it("serves none of the Nest server's internal routes", () => {
    const internal = routesOf(contracts.InternalApi);
    deepStrictEqual(internal.length > 0, true);
    deepStrictEqual(
      served.filter((route) => internal.includes(route)),
      [],
    );
  });
});
