import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenId } from "../domain/api-token/api-token.id.js";
import { ApiTokenRootOps } from "../domain/api-token/api-token.root-ops.js";
import { ApiTokenSpecifications } from "../domain/api-token/api-token.specification.js";
import { ApiTokenRepositoryFake } from "../infrastructure/repositories/api-token.repository-fake.js";
import { RevokeApiTokenCommand } from "./revoke-api-token.command.js";
import { RevokeApiTokenHandler } from "./revoke-api-token.handler.js";

const owner = UserId.parse("11111111-1111-1111-1111-111111111111");
const other = UserId.parse("22222222-2222-2222-2222-222222222222");
const apiTokenId = ApiTokenId.parse("33333333-3333-3333-3333-333333333333");

const seeded = async () => {
  const tokens = new ApiTokenRepositoryFake();
  await tokens.insertOne(
    ApiTokenRootOps.mint({
      id: apiTokenId,
      userId: owner,
      tokenHash: "h",
      prefix: "p",
      label: "l",
      now: new Date(),
      expiresAt: null,
    }),
  );
  return tokens;
};

describe("RevokeApiTokenHandler", () => {
  it("revokes the owner's token", async () => {
    const tokens = await seeded();
    const result = await new RevokeApiTokenHandler(tokens, PassThroughUnitOfWork).execute(
      new RevokeApiTokenCommand({ apiTokenId, userId: owner }),
    );
    deepStrictEqual(result.isOk(), true);
    deepStrictEqual(
      (await tokens.findMany(ApiTokenSpecifications.forUser(owner))).unwrap().length,
      0,
    );
  });

  it("reports ApiTokenNotFound for another user's token and for an unknown id", async () => {
    const tokens = await seeded();
    const handler = new RevokeApiTokenHandler(tokens, PassThroughUnitOfWork);
    const foreign = await handler.execute(new RevokeApiTokenCommand({ apiTokenId, userId: other }));
    deepStrictEqual(foreign.unwrapErr()._tag, "ApiTokenNotFound");
    const unknown = await handler.execute(
      new RevokeApiTokenCommand({
        apiTokenId: ApiTokenId.parse("44444444-4444-4444-4444-444444444444"),
        userId: owner,
      }),
    );
    deepStrictEqual(unknown.unwrapErr()._tag, "ApiTokenNotFound");
  });
});
