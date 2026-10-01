import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { z } from "zod";

import { type Database, sql } from "../database.js";
import { createTestDatabase } from "../test-utils/test-database.js";
import { backfillTodos } from "./backfill-todos.js";

const organizationId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const kept = "11111111-1111-1111-1111-111111111111";
const changed = "22222222-2222-2222-2222-222222222222";
const stale = "33333333-3333-3333-3333-333333333333";

const ReplicaRow = z.object({ id: z.guid(), title: z.string(), completed: z.boolean() });

const seedLegacy = async (db: Database, id: string, title: string, completed: boolean) => {
  await db.exec(sql.unsafe`
    INSERT INTO public.todos (id, organization_id, title, completed)
    VALUES (${id}, ${organizationId}, ${title}, ${completed})
  `);
};

const seedReplica = async (db: Database, id: string, title: string, completed: boolean) => {
  await db.exec(sql.unsafe`
    INSERT INTO todos.todos (id, organization_id, title, completed)
    VALUES (${id}, ${organizationId}, ${title}, ${completed})
  `);
};

const replica = (db: Database) =>
  db.any(sql.type(ReplicaRow)`SELECT id, title, completed FROM todos.todos ORDER BY id`);

describe.sequential("backfillTodos (integration)", () => {
  let db: Database;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await db.exec(sql.unsafe`TRUNCATE TABLE todos.todos`);
    await db.exec(sql.unsafe`TRUNCATE TABLE public.todos, public.organizations CASCADE`);
    await db.exec(sql.unsafe`
      INSERT INTO public.organizations (id, name) VALUES (${organizationId}, 'Acme')
    `);
  });

  it("copies what the legacy table has, overwrites what drifted, drops what it lost", async () => {
    await seedLegacy(db, kept, "Kept", false);
    await seedLegacy(db, changed, "Changed on hapi", true);
    await seedReplica(db, changed, "Stale title", false);
    await seedReplica(db, stale, "Deleted on hapi", false);

    deepStrictEqual(await backfillTodos(db), { upserted: 2, deleted: 1 });
    deepStrictEqual(await replica(db), [
      { id: kept, title: "Kept", completed: false },
      { id: changed, title: "Changed on hapi", completed: true },
    ]);
  });

  it("is idempotent: a second run touches nothing it has to", async () => {
    await seedLegacy(db, kept, "Kept", false);
    await backfillTodos(db);
    deepStrictEqual(await backfillTodos(db), { upserted: 1, deleted: 0 });
    deepStrictEqual(await replica(db), [{ id: kept, title: "Kept", completed: false }]);
  });
});
