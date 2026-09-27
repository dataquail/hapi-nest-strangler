import { deepStrictEqual } from "node:assert";

import { afterAll, beforeEach, describe, it } from "vitest";

import { purgeExpiredSessions } from "../../src/bin/purge-expired-sessions";
import { closeKnex, getKnex, truncateAll } from "../helpers/db";

const userId = "11111111-1111-1111-1111-111111111111";

type SessionShape = {
  id: string;
  expiresAt: string;
  absoluteExpiresAt: string;
  revokedAt: string | null;
};

const seedSession = (s: SessionShape) =>
  getKnex()("sessions").insert({
    id: s.id,
    user_id: userId,
    subject: "zitadel-sub",
    expires_at: s.expiresAt,
    absolute_expires_at: s.absoluteExpiresAt,
    revoked_at: s.revokedAt,
  });

const sessionIds = async (): Promise<string[]> =>
  (await getKnex()("sessions").select("id").orderBy("id")).map((row) => row.id as string);

describe.sequential("purgeExpiredSessions (integration)", () => {
  afterAll(closeKnex);

  beforeEach(async () => {
    await truncateAll();
    await getKnex()("users").insert({ id: userId, email: "admin@example.com" });
  });

  it("deletes expired rows and revoked rows older than seven days, keeps the rest", async () => {
    await seedSession({
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      expiresAt: "1999-01-01T00:00:00Z",
      absoluteExpiresAt: "1999-01-02T00:00:00Z",
      revokedAt: null,
    });
    await seedSession({
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      expiresAt: "2999-01-01T00:00:00Z",
      absoluteExpiresAt: "2999-01-02T00:00:00Z",
      revokedAt: "1999-01-01T00:00:00Z",
    });
    await seedSession({
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      expiresAt: "2999-01-01T00:00:00Z",
      absoluteExpiresAt: "2999-01-02T00:00:00Z",
      revokedAt: new Date().toISOString(),
    });
    await seedSession({
      id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      expiresAt: "2999-01-01T00:00:00Z",
      absoluteExpiresAt: "2999-01-02T00:00:00Z",
      revokedAt: null,
    });

    const result = await purgeExpiredSessions(getKnex());

    deepStrictEqual(result, { rowsPurged: 2, skipped: false });
    deepStrictEqual(await sessionIds(), [
      "cccccccc-cccc-cccc-cccc-cccccccccccc",
      "dddddddd-dddd-dddd-dddd-dddddddddddd",
    ]);
  });

  it("is a no-op on an empty table", async () => {
    deepStrictEqual(await purgeExpiredSessions(getKnex()), { rowsPurged: 0, skipped: false });
  });
});
