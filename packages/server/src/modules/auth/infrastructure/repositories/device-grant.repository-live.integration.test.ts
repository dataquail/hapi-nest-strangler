import { deepStrictEqual, notStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRootOps } from "@/modules/auth/domain/device-grant/device-grant.root-ops.js";
import { DeviceGrantSpecifications } from "@/modules/auth/domain/device-grant/device-grant.specification.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { DeviceGrantRepositoryLive } from "./device-grant.repository-live.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const id = DeviceGrantId.parse("22222222-2222-2222-2222-222222222222");

const insertUserRow = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'device@example.com', 'N/A', 'N/A', 'N/A', now(), now())
  `);

const start = (now: Date) =>
  DeviceGrantRootOps.start({
    id,
    deviceCodeHash: "dc-hash",
    userCode: "ABCD-2345",
    now,
    ttlSeconds: 600,
  });

describe.sequential("DeviceGrantRepositoryLive (integration)", () => {
  let db: Database;
  let repo: DeviceGrantRepositoryLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new DeviceGrantRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "auth.device_grants", "user.users");
  });

  it("insert + findOne by code hash and by user code round-trip", async () => {
    (await repo.insertOne(start(new Date()))).unwrap();
    const byHash = (await repo.findOne(DeviceGrantSpecifications.withCodeHash("dc-hash"))).unwrap();
    const byUser = (
      await repo.findOne(DeviceGrantSpecifications.withUserCode("ABCD-2345"))
    ).unwrap();
    if (byHash === null || byUser === null) throw new Error("expected a grant");
    deepStrictEqual(byHash.id, id);
    deepStrictEqual(byUser.status, "pending");
    deepStrictEqual(byUser.userId, null);
  });

  it("update persists an approval (status + user_id + approved_at)", async () => {
    await insertUserRow(db);
    const now = new Date();
    const grant = start(now);
    (await repo.insertOne(grant)).unwrap();
    (await repo.updateOne(DeviceGrantRootOps.approve({ grant, userId, now }))).unwrap();
    const after = (await repo.findOne(DeviceGrantSpecifications.withCodeHash("dc-hash"))).unwrap();
    if (after === null) throw new Error("expected a grant");
    deepStrictEqual(after.status, "approved");
    deepStrictEqual(after.userId, userId);
    notStrictEqual(after.approvedAt, null);
  });

  it("delete consumes the grant; a second delete is NotFound", async () => {
    (await repo.insertOne(start(new Date()))).unwrap();
    (await repo.deleteOne(id)).unwrap();
    deepStrictEqual(
      (await repo.findOne(DeviceGrantSpecifications.withCodeHash("dc-hash"))).unwrap(),
      null,
    );
    deepStrictEqual((await repo.deleteOne(id)).unwrapErr()._tag, "DeviceGrantNotFound");
  });
});
