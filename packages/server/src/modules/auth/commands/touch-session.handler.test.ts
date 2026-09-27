import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { SessionId } from "../domain/session/session.id.js";
import { SessionRootOps } from "../domain/session/session.root-ops.js";
import { SessionSpecifications } from "../domain/session/session.specification.js";
import { SessionRepositoryFake } from "../infrastructure/repositories/session.repository-fake.js";
import { TouchSessionCommand } from "./touch-session.command.js";
import { TouchSessionHandler } from "./touch-session.handler.js";

const sessionId = SessionId.parse("11111111-1111-1111-1111-111111111111");
const userId = UserId.parse("22222222-2222-2222-2222-222222222222");

const seeded = async (lastUsedAgoSeconds: number) => {
  const sessions = new SessionRepositoryFake();
  const now = new Date(Date.now() - lastUsedAgoSeconds * 1000);
  await sessions.insertOne(
    SessionRootOps.create({
      id: sessionId,
      userId,
      subject: "s",
      now,
      ttlSeconds: 3600,
      absoluteTtlSeconds: 86400,
    }),
  );
  return sessions;
};

describe("TouchSessionHandler", () => {
  it("slides the expiry once the threshold has elapsed", async () => {
    const sessions = await seeded(120);
    const before = (await sessions.findOne(SessionSpecifications.withId(sessionId))).unwrap()!;
    await new TouchSessionHandler(sessions, PassThroughUnitOfWork).execute(
      new TouchSessionCommand({ sessionId, ttlSeconds: 3600, thresholdSeconds: 60 }),
    );
    const after = (await sessions.findOne(SessionSpecifications.withId(sessionId))).unwrap()!;
    deepStrictEqual(after.expiresAt.getTime() > before.expiresAt.getTime(), true);
  });

  it("is a no-op inside the threshold", async () => {
    const sessions = await seeded(5);
    const before = (await sessions.findOne(SessionSpecifications.withId(sessionId))).unwrap()!;
    await new TouchSessionHandler(sessions, PassThroughUnitOfWork).execute(
      new TouchSessionCommand({ sessionId, ttlSeconds: 3600, thresholdSeconds: 60 }),
    );
    const after = (await sessions.findOne(SessionSpecifications.withId(sessionId))).unwrap()!;
    deepStrictEqual(after.expiresAt, before.expiresAt);
  });

  it("succeeds for an unknown session", async () => {
    const result = await new TouchSessionHandler(
      new SessionRepositoryFake(),
      PassThroughUnitOfWork,
    ).execute(new TouchSessionCommand({ sessionId, ttlSeconds: 3600, thresholdSeconds: 60 }));
    deepStrictEqual(result.isOk(), true);
  });
});
