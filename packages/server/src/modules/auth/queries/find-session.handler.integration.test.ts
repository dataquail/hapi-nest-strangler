import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { SessionId } from "../domain/session/session.id.js";
import { SessionRoot } from "../domain/session/session.root.js";
import { SessionRepositoryLive } from "../infrastructure/repositories/session.repository-live.js";
import { FindSessionHandler } from "./find-session.handler.js";
import { FindSessionQuery } from "./find-session.query.js";

const sessionId = SessionId.parse("22222222-2222-2222-2222-222222222222");
const userId = UserId.parse("11111111-1111-1111-1111-111111111111");

const farPast = new Date("2000-01-01T00:00:00Z");
const farFuture = new Date("2099-01-01T00:00:00Z");
const farFutureLater = new Date("2099-12-31T00:00:00Z");

const baseFields = {
  id: sessionId,
  userId,
  subject: "zitadel-sub",
  revokedAt: null,
  createdAt: farPast,
  lastUsedAt: farPast,
} as const;

const seedUser = (db: Database) =>
  db.exec(sql.unsafe`
    INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
    VALUES (${userId}, 'owner@example.com', 'USA', '123 Main St', '12345', now(), now())
  `);

describe.sequential("FindSessionHandler (integration)", () => {
  let db: Database;
  let repo: SessionRepositoryLive;
  let handler: FindSessionHandler;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new SessionRepositoryLive(db);
    handler = new FindSessionHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "auth.sessions", "user.users");
  });

  const insertSession = async (fields: Partial<SessionRoot>) => {
    await seedUser(db);
    (
      await repo.insertOne(
        SessionRoot.parse({
          ...baseFields,
          expiresAt: farFuture,
          absoluteExpiresAt: farFutureLater,
          ...fields,
        }),
      )
    ).unwrap();
  };

  it("returns the session when valid", async () => {
    await insertSession({});
    const result = await handler.execute(new FindSessionQuery({ sessionId }));
    deepStrictEqual(result.unwrap(), { id: sessionId, userId });
  });

  it("fails SessionNotFound for an unknown id", async () => {
    const result = await handler.execute(new FindSessionQuery({ sessionId }));
    deepStrictEqual(result.unwrapErr()._tag, "SessionNotFound");
  });

  it("fails SessionRevoked when revokedAt is set", async () => {
    await insertSession({ revokedAt: farPast });
    const result = await handler.execute(new FindSessionQuery({ sessionId }));
    deepStrictEqual(result.unwrapErr()._tag, "SessionRevoked");
  });

  it("fails SessionExpired when expiresAt is in the past", async () => {
    await insertSession({ expiresAt: farPast });
    const result = await handler.execute(new FindSessionQuery({ sessionId }));
    deepStrictEqual(result.unwrapErr()._tag, "SessionExpired");
  });

  it("fails SessionExpired when absoluteExpiresAt is in the past", async () => {
    await insertSession({ absoluteExpiresAt: farPast });
    const result = await handler.execute(new FindSessionQuery({ sessionId }));
    deepStrictEqual(result.unwrapErr()._tag, "SessionExpired");
  });
});
