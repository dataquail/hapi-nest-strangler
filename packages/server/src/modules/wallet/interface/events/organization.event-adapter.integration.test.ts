import { deepStrictEqual, ok, rejects } from "node:assert";

import { type Database, RowSchemas, sql } from "@org/database";
import { makeEventBus } from "@org/event-bus";
import { makeUnitOfWork } from "@org/unit-of-work";
import { Ok } from "oxide.ts";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import type { CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import { CreateWalletHandler } from "@/modules/wallet/commands/create-wallet.handler.js";
import { WalletRepositoryLive } from "@/modules/wallet/infrastructure/repositories/wallet.repository-live.js";
import { organizationAccessDomainEvents } from "@/modules/wallet/wallet.imports.js";
import type { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { makeTransactionDriver } from "@/platform/database/transaction-driver.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { MEMBER_CALLER } from "@/test-utils/fake-auth-guard.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { OrganizationEventAdapter } from "./organization.event-adapter.js";

const WALLET_TABLES = [
  "wallet.wallets",
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

describe.sequential("organization → wallet adapter (integration)", () => {
  // Creating an org inserts a membership row FK'd to the caller's users row.
  const runtime = useServerTestRuntime(WALLET_TABLES, {
    caller: MEMBER_CALLER,
    seedSuperAdminCaller: true,
  });

  it("creates a wallet with balance 0 in the same transaction as the organization", async () => {
    const { client, database } = runtime.server();
    const created = await client.POST("/orgs", { body: { name: "Acme" } });
    ok(created.data !== undefined, JSON.stringify(created.error));

    // The wallet module exposes no read surface, so this reads the table by schema.
    const rows = await database.any(
      sql.type(
        RowSchemas.WalletRow,
      )`SELECT * FROM wallet.wallets WHERE organization_id = ${created.data.id}`,
    );
    deepStrictEqual(rows.length, 1);
    deepStrictEqual(rows[0]?.balance, 0);
  });
});

// The load-bearing claim of ADR-0007 under the command-dispatch model: the
// adapter dispatches inside the publisher's scope, so the two writes share one
// transaction in both directions of failure.
const probeOrgId = OrganizationId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

const insertProbeOrg = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${probeOrgId}, 'Rollback Probe Org', NOW(), NOW(), null)
  `);

const countOrgs = async (db: Database): Promise<number> =>
  (
    await db.any(
      sql.type(
        RowSchemas.OrganizationRow,
      )`SELECT * FROM "organization".organizations WHERE id = ${probeOrgId}`,
    )
  ).length;

const countWallets = async (db: Database): Promise<number> =>
  (
    await db.any(
      sql.type(
        RowSchemas.WalletRow,
      )`SELECT * FROM wallet.wallets WHERE organization_id = ${probeOrgId}`,
    )
  ).length;

const orgCreated = () =>
  organizationAccessDomainEvents.OrganizationCreated.make({
    organizationId: probeOrgId,
    name: "Probe",
  });

describe.sequential("organization → wallet adapter (rollback integration)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "wallet.wallets", "organization.organizations");
  });

  it("rolls back the publisher's writes when the dispatched command throws", async () => {
    const events = makeEventBus();
    const { unitOfWork } = makeUnitOfWork({ driver: makeTransactionDriver(db), eventBus: events });
    const failingCommandBus = {
      execute: () => Promise.reject(new Error("simulated wallet command failure")),
    } as unknown as AppCommandBus;
    new OrganizationEventAdapter(events, failingCommandBus).onModuleInit();

    await rejects(
      unitOfWork.run(async () => {
        await insertProbeOrg(db);
        await events.dispatch([orgCreated()]);
      }),
      /simulated wallet command failure/,
    );
    deepStrictEqual(await countOrgs(db), 0);
  });

  it("rolls back the dispatched command's write when the publisher fails afterwards", async () => {
    const events = makeEventBus();
    const { unitOfWork } = makeUnitOfWork({ driver: makeTransactionDriver(db), eventBus: events });
    const handler = new CreateWalletHandler(new WalletRepositoryLive(db), events, unitOfWork);
    const commandBus = {
      execute: (command: CreateWalletCommand) => handler.execute(command),
    } as unknown as AppCommandBus;
    new OrganizationEventAdapter(events, commandBus).onModuleInit();

    await rejects(
      unitOfWork.run(async () => {
        await insertProbeOrg(db);
        await events.dispatch([orgCreated()]);
        deepStrictEqual(await countWallets(db), 1);
        throw new Error("publisher failed after the wallet was written");
      }),
      /publisher failed/,
    );
    deepStrictEqual(await countWallets(db), 0);
    deepStrictEqual(await countOrgs(db), 0);
  });

  it("commits both writes when everything succeeds", async () => {
    const events = makeEventBus();
    const { unitOfWork } = makeUnitOfWork({ driver: makeTransactionDriver(db), eventBus: events });
    const handler = new CreateWalletHandler(new WalletRepositoryLive(db), events, unitOfWork);
    const commandBus = {
      execute: (command: CreateWalletCommand) => handler.execute(command),
    } as unknown as AppCommandBus;
    new OrganizationEventAdapter(events, commandBus).onModuleInit();

    const outcome = await unitOfWork.run(async () => {
      await insertProbeOrg(db);
      await events.dispatch([orgCreated()]);
      return Ok(undefined);
    });
    deepStrictEqual(outcome.isOk(), true);
    deepStrictEqual(await countWallets(db), 1);
  });
});
