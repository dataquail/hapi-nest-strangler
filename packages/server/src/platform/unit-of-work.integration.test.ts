import { deepStrictEqual, rejects } from "node:assert";

import { type Database, RowSchemas, sql } from "@org/database";
import { makeEventBus } from "@org/event-bus";
import * as Event from "@org/event-bus/event";
import { makeUnitOfWork } from "@org/unit-of-work";
import { Err, Ok } from "oxide.ts";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { z } from "zod";

import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { makeTransactionDriver } from "./database/transaction-driver.js";

// Proves the re-entrancy contract of `UnitOfWork.run`: a nested `run` (a
// command fired from inside another command's unit of work) JOINS the outer
// transaction rather than opening a second one on a foreign connection.

const outerId = "aaaaaaaa-0000-0000-0000-000000000001";
const innerId = "aaaaaaaa-0000-0000-0000-000000000002";

// A post-commit handler writes this marker row in its own transaction, so its
// presence or absence is the observable signal for the drain.
const markerId = "bbbbbbbb-0000-0000-0000-000000000001";
const PostCommitTestEvent = Event.make("PostCommitTestEvent", { marker: z.string() });

// A wallet row doubles as its own organization: the table's only constraint
// is one wallet per organization, so distinct ids keep every insert distinct.
const insert = (db: Database, id: string) =>
  db.exec(sql.unsafe`
    INSERT INTO wallet.wallets (id, organization_id, balance, created_at, updated_at)
    VALUES (${id}, ${id}, 0, now(), now())
  `);

const seeded = (db: Database) =>
  db.any(
    sql.type(
      RowSchemas.WalletRow,
    )`SELECT * FROM wallet.wallets WHERE id IN (${outerId}, ${innerId})`,
  );

const flushed = (db: Database) =>
  db.any(
    sql.type(
      RowSchemas.WalletRow,
    )`SELECT * FROM wallet.wallets WHERE id IN (${outerId}, ${markerId})`,
  );

const makeRuntime = (db: Database) => {
  const eventBus = makeEventBus();
  const { unitOfWork } = makeUnitOfWork({ driver: makeTransactionDriver(db), eventBus });
  return { eventBus, unitOfWork };
};

describe.sequential("UnitOfWork re-entrancy (integration)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "wallet.wallets");
  });

  it("a nested run commits together with the outer transaction", async () => {
    const { unitOfWork } = makeRuntime(db);
    await unitOfWork.run(async () => {
      await insert(db, outerId);
      await unitOfWork.run(() => insert(db, innerId));
    });
    deepStrictEqual((await seeded(db)).length, 2);
  });

  it("a failure after a nested run rolls back the nested write too", async () => {
    const { unitOfWork } = makeRuntime(db);
    await rejects(
      unitOfWork.run(async () => {
        await insert(db, outerId);
        await unitOfWork.run(() => insert(db, innerId));
        // If the nested run had opened its own transaction, innerId would survive this.
        throw new Error("boom");
      }),
    );
    deepStrictEqual((await seeded(db)).length, 0);
  });

  it("a typed failure (Err) rolls the unit of work back and is returned unchanged", async () => {
    const { unitOfWork } = makeRuntime(db);
    const result = await unitOfWork.run(async () => {
      await insert(db, outerId);
      return Err("typed boom" as const);
    });
    deepStrictEqual(result.unwrapErr(), "typed boom");
    deepStrictEqual((await seeded(db)).length, 0);
  });

  // The savepoint contract: a nested `run` opens a real SAVEPOINT, so a failure
  // inside it that the caller CATCHES rolls back only the nested write while
  // the outer transaction goes on to commit.
  it("a caught nested failure rolls back only the savepoint while the outer commits", async () => {
    const { unitOfWork } = makeRuntime(db);
    await unitOfWork.run(async () => {
      await insert(db, outerId);
      const inner = await unitOfWork.run(async () => {
        await insert(db, innerId);
        return Err("nested boom" as const);
      });
      deepStrictEqual(inner.isErr(), true);
      return Ok(undefined);
    });
    const rows = await seeded(db);
    deepStrictEqual(rows.length, 1);
    deepStrictEqual(rows[0]?.id, outerId);
  });
});

// The post-commit bus contract: events dispatched inside a unit of work are
// buffered, then drained AFTER the transaction commits, each handler in its
// own transaction with its failure isolated, and discarded entirely if the
// producer rolls back.
describe.sequential("UnitOfWork post-commit drain (integration)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "wallet.wallets");
  });

  it("drains a buffered handler after the producer commits", async () => {
    const { eventBus, unitOfWork } = makeRuntime(db);
    eventBus.subscribeAfterCommit(PostCommitTestEvent, async () => {
      await insert(db, markerId);
    });
    await unitOfWork.run(async () => {
      await insert(db, outerId);
      await eventBus.dispatch([PostCommitTestEvent.make({ marker: "x" })]);
    });
    deepStrictEqual((await flushed(db)).length, 2);
  });

  it("a failing handler does not roll back the producer (failure isolated)", async () => {
    const { eventBus, unitOfWork } = makeRuntime(db);
    eventBus.subscribeAfterCommit(PostCommitTestEvent, () =>
      Promise.reject(new Error("handler boom")),
    );
    await unitOfWork.run(async () => {
      await insert(db, outerId);
      await eventBus.dispatch([PostCommitTestEvent.make({ marker: "x" })]);
    });
    const rows = await flushed(db);
    deepStrictEqual(rows.length, 1);
    deepStrictEqual(rows[0]?.id, outerId);
  });

  it("a producer rollback discards the buffered events (no drain)", async () => {
    const { eventBus, unitOfWork } = makeRuntime(db);
    eventBus.subscribeAfterCommit(PostCommitTestEvent, async () => {
      await insert(db, markerId);
    });
    await rejects(
      unitOfWork.run(async () => {
        await insert(db, outerId);
        await eventBus.dispatch([PostCommitTestEvent.make({ marker: "x" })]);
        throw new Error("producer boom");
      }),
    );
    deepStrictEqual((await flushed(db)).length, 0);
  });

  it("a rolled-back savepoint discards the events emitted inside it", async () => {
    const { eventBus, unitOfWork } = makeRuntime(db);
    eventBus.subscribeAfterCommit(PostCommitTestEvent, async () => {
      await insert(db, markerId);
    });
    await unitOfWork.run(async () => {
      await insert(db, outerId);
      // The nested savepoint dispatches then fails; the caught failure rolls
      // the savepoint back and truncates its buffered events.
      await unitOfWork.run(async () => {
        await eventBus.dispatch([PostCommitTestEvent.make({ marker: "x" })]);
        return Err("savepoint boom" as const);
      });
      return Ok(undefined);
    });
    const rows = await flushed(db);
    deepStrictEqual(rows.length, 1);
    deepStrictEqual(rows[0]?.id, outerId);
  });
});
