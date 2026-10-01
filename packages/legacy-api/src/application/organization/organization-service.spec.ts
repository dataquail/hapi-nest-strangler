import { deepStrictEqual, rejects } from "node:assert";

import { describe, it, vi } from "vitest";

import { BackendClientError } from "../../lib/backend-client/http";
import OrganizationService = require("./organization-service");

// A knex stub: every table call returns a chain that resolves, and
// `transaction` runs the callback then either commits or fails to.
const makeKnex = (options: { failCommit?: boolean } = {}) => {
  const inserts: Array<{ table: string; row: unknown }> = [];
  const chain = (table: string) => ({
    transacting: () => ({
      insert: async (row: unknown) => {
        inserts.push({ table, row });
      },
    }),
  });
  const knex: any = (table: string) => chain(table);
  knex.transaction = async (work: (t: unknown) => Promise<void>) => {
    await work({});
    if (options.failCommit) throw new Error("could not serialize access due to concurrent update");
  };
  return { knex, inserts };
};

const makeService = (knex: any, wallets: { create: any; remove: any }) => {
  const server = { events: { emit: vi.fn() } };
  return new OrganizationService({ knex } as any, server as any, {} as any, {
    todos: { create: vi.fn() },
    wallets: { ...wallets, get: vi.fn() },
  });
};

describe("OrganizationService.createOrganization", () => {
  it("opens the wallet inside the transaction and announces the organization", async () => {
    const { inserts, knex } = makeKnex();
    const wallets = { create: vi.fn().mockResolvedValue({ id: "w" }), remove: vi.fn() };
    const service = makeService(knex, wallets);

    const id = await service.createOrganization("Acme", "user-1");

    deepStrictEqual(wallets.create.mock.calls, [[{ organizationId: id }]]);
    deepStrictEqual(
      inserts.map((i) => i.table),
      ["organizations", "memberships", "organization_roles"],
    );
    deepStrictEqual(wallets.remove.mock.calls.length, 0);
    deepStrictEqual((service.server.events.emit as any).mock.calls[0][0], "organization-created");
  });

  it("rolls back and answers 502 when the wallet service refuses, without compensating", async () => {
    const { inserts, knex } = makeKnex();
    const wallets = {
      create: vi
        .fn()
        .mockRejectedValue(new BackendClientError("POST /internal/wallets answered 503", 503)),
      remove: vi.fn(),
    };
    const service = makeService(knex, wallets);

    await rejects(service.createOrganization("Acme", "user-1"), (error: any) => {
      deepStrictEqual(error.output.statusCode, 502);
      deepStrictEqual(error.output.payload._tag, "BadGateway");
      return true;
    });
    // The role insert never ran: the throw left the transaction, which rolled back.
    deepStrictEqual(
      inserts.map((i) => i.table),
      ["organizations", "memberships"],
    );
    deepStrictEqual(wallets.remove.mock.calls.length, 0);
    deepStrictEqual((service.server.events.emit as any).mock.calls.length, 0);
  });

  it("deletes the wallet again when the transaction fails after the wallet was opened", async () => {
    const { knex } = makeKnex({ failCommit: true });
    const wallets = {
      create: vi.fn().mockResolvedValue({ id: "w" }),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const service = makeService(knex, wallets);

    await rejects(service.createOrganization("Acme", "user-1"), /concurrent update/);

    const organizationId = wallets.create.mock.calls[0][0].organizationId;
    deepStrictEqual(wallets.remove.mock.calls, [[organizationId]]);
  });

  it("swallows a failed compensation and still reports the original failure", async () => {
    const { knex } = makeKnex({ failCommit: true });
    const wallets = {
      create: vi.fn().mockResolvedValue({ id: "w" }),
      remove: vi.fn().mockRejectedValue(new BackendClientError("DELETE failed", null)),
    };
    const service = makeService(knex, wallets);

    await rejects(service.createOrganization("Acme", "user-1"), /concurrent update/);
    deepStrictEqual(wallets.remove.mock.calls.length, 1);
  });
});
