import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { ApiTokenSpecifications } from "../domain/api-token/api-token.specification.js";
import { CredentialHash } from "../domain/domain-services/credential-hash.domain-service.js";
import { ApiTokenRepositoryFake } from "../infrastructure/repositories/api-token.repository-fake.js";
import { MintApiTokenCommand } from "./mint-api-token.command.js";
import { MintApiTokenHandler } from "./mint-api-token.handler.js";

const userId = UserId.parse("11111111-1111-1111-1111-111111111111");

describe("MintApiTokenHandler", () => {
  it("returns the plaintext once and persists only its hash", async () => {
    const tokens = new ApiTokenRepositoryFake();
    const result = await new MintApiTokenHandler(tokens, PassThroughUnitOfWork).execute(
      new MintApiTokenCommand({ userId, label: "cli", expiresInDays: 30 }),
    );
    const { apiToken, token } = result.unwrap();
    deepStrictEqual(token.startsWith("pat_"), true);
    deepStrictEqual(token.startsWith(apiToken.prefix), true);
    deepStrictEqual(apiToken.tokenHash, CredentialHash.of(token));
    const stored = (
      await tokens.findOne(ApiTokenSpecifications.withHash(CredentialHash.of(token)))
    ).unwrap();
    deepStrictEqual(stored?.id, apiToken.id);
    deepStrictEqual(stored?.label, "cli");
  });

  it("computes the expiry from expiresInDays", async () => {
    const result = await new MintApiTokenHandler(
      new ApiTokenRepositoryFake(),
      PassThroughUnitOfWork,
    ).execute(new MintApiTokenCommand({ userId, label: "cli", expiresInDays: 1 }));
    const { apiToken } = result.unwrap();
    deepStrictEqual(apiToken.expiresAt!.getTime() - apiToken.createdAt.getTime(), 86_400_000);
  });
});
