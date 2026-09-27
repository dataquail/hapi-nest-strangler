import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenId } from "../domain/api-token/api-token.id.js";
import { ApiTokenRootOps } from "../domain/api-token/api-token.root-ops.js";
import { ApiTokenSpecifications } from "../domain/api-token/api-token.specification.js";
import { ApiTokenRepositoryFake } from "../infrastructure/repositories/api-token.repository-fake.js";
import { TouchApiTokenCommand } from "./touch-api-token.command.js";
import { TouchApiTokenHandler } from "./touch-api-token.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");
const apiTokenId = ApiTokenId.parse("33333333-3333-3333-3333-333333333333");

const seeded = async (lastUsedAgoSeconds: number) => {
  const tokens = new ApiTokenRepositoryFake();
  const now = new Date(Date.now() - lastUsedAgoSeconds * 1000);
  await tokens.insertOne(
    ApiTokenRootOps.mint({
      id: apiTokenId,
      userId,
      tokenHash: "h",
      prefix: "p",
      label: "l",
      now,
      expiresAt: null,
    }),
  );
  return tokens;
};

describe("TouchApiTokenHandler", () => {
  it("stamps lastUsedAt once the threshold has elapsed", async () => {
    const tokens = await seeded(120);
    const before = (await tokens.findOne(ApiTokenSpecifications.withId(apiTokenId))).unwrap()!;
    await new TouchApiTokenHandler(tokens, PassThroughUnitOfWork).execute(
      new TouchApiTokenCommand({ apiTokenId, thresholdSeconds: 60 }),
    );
    const after = (await tokens.findOne(ApiTokenSpecifications.withId(apiTokenId))).unwrap()!;
    deepStrictEqual(after.lastUsedAt.getTime() > before.lastUsedAt.getTime(), true);
  });

  it("is a no-op inside the threshold and for an unknown token", async () => {
    const tokens = await seeded(5);
    const before = (await tokens.findOne(ApiTokenSpecifications.withId(apiTokenId))).unwrap()!;
    const handler = new TouchApiTokenHandler(tokens, PassThroughUnitOfWork);
    await handler.execute(new TouchApiTokenCommand({ apiTokenId, thresholdSeconds: 60 }));
    const after = (await tokens.findOne(ApiTokenSpecifications.withId(apiTokenId))).unwrap()!;
    deepStrictEqual(after.lastUsedAt, before.lastUsedAt);
    const unknown = await handler.execute(
      new TouchApiTokenCommand({
        apiTokenId: ApiTokenId.parse("44444444-4444-4444-4444-444444444444"),
        thresholdSeconds: 60,
      }),
    );
    deepStrictEqual(unknown.isOk(), true);
  });
});
