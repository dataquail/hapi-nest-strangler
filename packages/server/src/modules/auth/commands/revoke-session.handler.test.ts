import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { SessionId } from "../domain/session/session.id.js";
import { SessionRootOps } from "../domain/session/session.root-ops.js";
import { SessionSpecifications } from "../domain/session/session.specification.js";
import { SessionRepositoryFake } from "../infrastructure/repositories/session.repository-fake.js";
import { RevokeSessionCommand } from "./revoke-session.command.js";
import { RevokeSessionHandler } from "./revoke-session.handler.js";

const sessionId = SessionId.parse("11111111-1111-1111-1111-111111111111");
const userId = UserId.parse("22222222-2222-2222-2222-222222222222");

describe("RevokeSessionHandler", () => {
  it("revokes an active session", async () => {
    const sessions = new SessionRepositoryFake();
    await sessions.insertOne(
      SessionRootOps.create({
        id: sessionId,
        userId,
        subject: "s",
        now: new Date(),
        ttlSeconds: 60,
        absoluteTtlSeconds: 600,
      }),
    );
    const result = await new RevokeSessionHandler(sessions, PassThroughUnitOfWork).execute(
      new RevokeSessionCommand({ sessionId }),
    );
    deepStrictEqual(result.isOk(), true);
    const stored = (await sessions.findOne(SessionSpecifications.withId(sessionId))).unwrap();
    deepStrictEqual(stored?.revokedAt instanceof Date, true);
  });

  it("succeeds for a missing or already revoked session", async () => {
    const handler = new RevokeSessionHandler(new SessionRepositoryFake(), PassThroughUnitOfWork);
    deepStrictEqual((await handler.execute(new RevokeSessionCommand({ sessionId }))).isOk(), true);
    deepStrictEqual((await handler.execute(new RevokeSessionCommand({ sessionId }))).isOk(), true);
  });
});
