import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { AuthIdentitySpecifications } from "@/modules/auth/domain/auth-identity/auth-identity.specification.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { AuthIdentityRepositoryLive } from "./auth-identity.repository-live.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const subject = "zitadel-sub-integration";

const insertUserRow = (db: Database, email: string) =>
  db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, ${email}, 'N/A', 'N/A', 'N/A', now(), now())
  `);

const insertIdentityRow = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO auth.auth_identities (subject, user_id, provider, created_at)
    VALUES (${subject}, ${userId}, 'zitadel', now())
  `);

describe.sequential("AuthIdentityRepositoryLive (integration)", () => {
  let db: Database;
  let repo: AuthIdentityRepositoryLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new AuthIdentityRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "auth.auth_identities", "user.users");
  });

  it("findOne(bySubject) returns the seeded identity", async () => {
    await insertUserRow(db, "admin@example.com");
    await insertIdentityRow(db);
    const found = (await repo.findOne(AuthIdentitySpecifications.bySubject(subject))).unwrap();
    if (found === null) throw new Error("expected an identity");
    deepStrictEqual(found.subject, subject);
    deepStrictEqual(found.userId, userId);
    deepStrictEqual(found.provider, "zitadel");
  });

  it("insert links a subject to a user, retrievable via findOne(bySubject)", async () => {
    await insertUserRow(db, "jit@example.com");
    (await repo.insertOne({ subject: "jit-sub", userId, provider: "zitadel" })).unwrap();
    const found = (await repo.findOne(AuthIdentitySpecifications.bySubject("jit-sub"))).unwrap();
    if (found === null) throw new Error("expected an identity");
    deepStrictEqual(found.subject, "jit-sub");
    deepStrictEqual(found.userId, userId);
    deepStrictEqual(found.provider, "zitadel");
  });

  it("findOne returns null for an unknown subject (absence is not an error)", async () => {
    deepStrictEqual(
      (await repo.findOne(AuthIdentitySpecifications.bySubject("missing-sub"))).unwrap(),
      null,
    );
  });
});
