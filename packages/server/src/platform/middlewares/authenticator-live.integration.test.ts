import { deepStrictEqual, rejects } from "node:assert";
import { randomUUID } from "node:crypto";

import { type Database, RowSchemas, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { EnvVars } from "@/common/env-vars.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { HttpProblem } from "@/platform/http/http-problem.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";
import { TEST_SERVICE_SECRET } from "@/test-utils/test-service-token.js";

import { AuthenticatorLive } from "./authenticator-live.js";

const env = EnvVars.load({
  DATABASE_URL: "postgres://unused",
  INTER_SERVICE_JWT_SECRET: TEST_SERVICE_SECRET,
  SESSION_COOKIE_NAME: "session",
  SESSION_COOKIE_SECRET: "test-session-cookie-secret",
  SESSION_TTL_SECONDS: "3600",
  SESSION_TOUCH_THRESHOLD_SECONDS: "60",
  API_TOKEN_TOUCH_THRESHOLD_SECONDS: "60",
});
const codec = new CookieCodec(env);

const HOUR_MS = 3600_000;
const MINUTES_AGO = (minutes: number): Date => new Date(Date.now() - minutes * 60_000);

const sha256 = async (raw: string): Promise<string> => {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(raw).digest("hex");
};

const seedUser = async (db: Database): Promise<string> => {
  const id = randomUUID();
  await db.exec(sql.unsafe`
    INSERT INTO public.users (id, email) VALUES (${id}, ${`${id}@test.local`})
  `);
  return id;
};

type SessionOverrides = Partial<{
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date;
}>;

const seedSession = async (
  db: Database,
  userId: string,
  overrides: SessionOverrides = {},
): Promise<string> => {
  const id = randomUUID();
  const now = new Date();
  const row = {
    expiresAt: new Date(now.getTime() + HOUR_MS),
    absoluteExpiresAt: new Date(now.getTime() + 12 * HOUR_MS),
    revokedAt: null,
    lastUsedAt: now,
    ...overrides,
  };
  await db.exec(sql.unsafe`
    INSERT INTO public.sessions
      (id, user_id, subject, expires_at, absolute_expires_at, revoked_at, last_used_at)
    VALUES (${id}, ${userId}, ${`sub-${userId}`}, ${sql.timestamp(row.expiresAt)},
            ${sql.timestamp(row.absoluteExpiresAt)},
            ${row.revokedAt === null ? null : sql.timestamp(row.revokedAt)},
            ${sql.timestamp(row.lastUsedAt)})
  `);
  return id;
};

type ApiTokenOverrides = Partial<{
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date;
}>;

const seedApiToken = async (
  db: Database,
  userId: string,
  raw: string,
  overrides: ApiTokenOverrides = {},
): Promise<string> => {
  const id = randomUUID();
  const row = { expiresAt: null, revokedAt: null, lastUsedAt: new Date(), ...overrides };
  await db.exec(sql.unsafe`
    INSERT INTO public.api_tokens
      (id, user_id, token_hash, prefix, label, expires_at, revoked_at, last_used_at)
    VALUES (${id}, ${userId}, ${await sha256(raw)}, 'pat_test', 'test',
            ${row.expiresAt === null ? null : sql.timestamp(row.expiresAt)},
            ${row.revokedAt === null ? null : sql.timestamp(row.revokedAt)},
            ${sql.timestamp(row.lastUsedAt)})
  `);
  return id;
};

const sessionRow = (db: Database, id: string) =>
  db.one(sql.type(RowSchemas.LegacySessionRow)`
    SELECT id, user_id, expires_at, absolute_expires_at, revoked_at, last_used_at
    FROM public.sessions WHERE id = ${id}
  `);

const apiTokenRow = (db: Database, id: string) =>
  db.one(sql.type(RowSchemas.LegacyApiTokenRow)`
    SELECT id, user_id, expires_at, revoked_at, last_used_at
    FROM public.api_tokens WHERE id = ${id}
  `);

const cookieFor = (sessionId: string): string => `session=${codec.sign(sessionId)}`;

const unauthorized = (error: unknown): boolean => {
  deepStrictEqual(HttpProblem.is(error), true);
  deepStrictEqual((error as HttpProblem).getStatus(), 401);
  return true;
};

describe("AuthenticatorLive over the legacy API's session rows", () => {
  let db: Database;
  let authenticator: AuthenticatorLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    authenticator = new AuthenticatorLive(env, codec, db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "public.sessions", "public.api_tokens", "public.users");
  });

  it("resolves a cookie the legacy API signed to the session's user", async () => {
    const userId = await seedUser(db);
    const sessionId = await seedSession(db, userId);
    deepStrictEqual(await authenticator.fromSessionCookie(cookieFor(sessionId)), {
      sessionId,
      userId,
    });
  });

  it("rejects a missing, unsigned, tampered or unknown session cookie with 401", async () => {
    const userId = await seedUser(db);
    const sessionId = await seedSession(db, userId);
    await rejects(authenticator.fromSessionCookie(undefined), unauthorized);
    await rejects(authenticator.fromSessionCookie("other=1"), unauthorized);
    await rejects(authenticator.fromSessionCookie(`session=${sessionId}`), unauthorized);
    await rejects(authenticator.fromSessionCookie(`${cookieFor(sessionId)}x`), unauthorized);
    await rejects(authenticator.fromSessionCookie(cookieFor(randomUUID())), unauthorized);
    await rejects(authenticator.fromSessionCookie(cookieFor("not-a-uuid")), unauthorized);
  });

  it("rejects an expired, absolutely expired or revoked session with 401", async () => {
    const userId = await seedUser(db);
    const expired = await seedSession(db, userId, { expiresAt: MINUTES_AGO(1) });
    const absolutelyExpired = await seedSession(db, userId, { absoluteExpiresAt: MINUTES_AGO(1) });
    const revoked = await seedSession(db, userId, { revokedAt: MINUTES_AGO(1) });
    await rejects(authenticator.fromSessionCookie(cookieFor(expired)), unauthorized);
    await rejects(authenticator.fromSessionCookie(cookieFor(absolutelyExpired)), unauthorized);
    await rejects(authenticator.fromSessionCookie(cookieFor(revoked)), unauthorized);
  });

  it("slides the expiry the way the legacy API does once the touch threshold has passed", async () => {
    const userId = await seedUser(db);
    const stale = await seedSession(db, userId, {
      expiresAt: new Date(Date.now() + 5 * 60_000),
      lastUsedAt: MINUTES_AGO(5),
    });
    const before = await sessionRow(db, stale);
    await authenticator.fromSessionCookie(cookieFor(stale));
    const after = await sessionRow(db, stale);
    deepStrictEqual(after.expires_at > before.expires_at, true);
    deepStrictEqual(after.last_used_at > before.last_used_at, true);
  });

  it("caps the slid expiry at the absolute expiry and leaves a fresh session alone", async () => {
    const userId = await seedUser(db);
    const absoluteExpiresAt = new Date(Date.now() + 10 * 60_000);
    const nearAbsolute = await seedSession(db, userId, {
      expiresAt: new Date(Date.now() + 5 * 60_000),
      absoluteExpiresAt,
      lastUsedAt: MINUTES_AGO(5),
    });
    await authenticator.fromSessionCookie(cookieFor(nearAbsolute));
    deepStrictEqual((await sessionRow(db, nearAbsolute)).expires_at, absoluteExpiresAt);

    const fresh = await seedSession(db, userId);
    const before = await sessionRow(db, fresh);
    await authenticator.fromSessionCookie(cookieFor(fresh));
    deepStrictEqual(await sessionRow(db, fresh), before);
  });

  it("resolves a bearer API token by its hash and stamps its last use", async () => {
    const userId = await seedUser(db);
    const tokenId = await seedApiToken(db, userId, "pat_abc_secret", {
      lastUsedAt: MINUTES_AGO(5),
    });
    deepStrictEqual(await authenticator.fromBearer("pat_abc_secret"), {
      sessionId: tokenId,
      userId,
    });
    deepStrictEqual((await apiTokenRow(db, tokenId)).last_used_at > MINUTES_AGO(1), true);
  });

  it("rejects an unknown, expired or revoked API token with 401", async () => {
    const userId = await seedUser(db);
    await seedApiToken(db, userId, "pat_expired", { expiresAt: MINUTES_AGO(1) });
    await seedApiToken(db, userId, "pat_revoked", { revokedAt: MINUTES_AGO(1) });
    await rejects(authenticator.fromBearer("pat_unknown"), unauthorized);
    await rejects(authenticator.fromBearer("pat_expired"), unauthorized);
    await rejects(authenticator.fromBearer("pat_revoked"), unauthorized);
  });
});
