import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { WalletRootOps } from "@/modules/wallet/domain/wallet/wallet.root-ops.js";
import { WalletSpecifications } from "@/modules/wallet/domain/wallet/wallet.specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletRepositoryFake } from "./wallet.repository-fake.js";

const acmeId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const betaId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const walletA = WalletId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const walletB = WalletId.parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = new Date("2025-01-01T00:00:00Z");

describe("WalletRepositoryFake", () => {
  it("stores a wallet and makes it findable by organizationId", async () => {
    const repo = new WalletRepositoryFake();
    const { wallet } = WalletRootOps.create({ id: walletA, organizationId: acmeId, now });
    await repo.insertOne(wallet);
    deepStrictEqual(
      (await repo.findOne(WalletSpecifications.forOrganization(acmeId))).unwrap(),
      wallet,
    );
  });

  it("fails WalletAlreadyExistsForOrganization when a wallet already exists for the org", async () => {
    const repo = new WalletRepositoryFake();
    await repo.insertOne(WalletRootOps.create({ id: walletA, organizationId: acmeId, now }).wallet);
    const clashing = await repo.insertOne(
      WalletRootOps.create({ id: walletB, organizationId: acmeId, now }).wallet,
    );
    deepStrictEqual(
      { ...clashing.unwrapErr() },
      { _tag: "WalletAlreadyExistsForOrganization", organizationId: acmeId },
    );
  });

  it("allows different organizations to each have their own wallet", async () => {
    const repo = new WalletRepositoryFake();
    await repo.insertOne(WalletRootOps.create({ id: walletA, organizationId: acmeId, now }).wallet);
    await repo.insertOne(WalletRootOps.create({ id: walletB, organizationId: betaId, now }).wallet);
    deepStrictEqual(
      (await repo.findOne(WalletSpecifications.forOrganization(acmeId))).unwrap()?.id,
      walletA,
    );
    deepStrictEqual(
      (await repo.findOne(WalletSpecifications.forOrganization(betaId))).unwrap()?.id,
      walletB,
    );
  });

  it("returns null when no wallet exists for the org, and each instance has its own store", async () => {
    const first = new WalletRepositoryFake();
    await first.insertOne(
      WalletRootOps.create({ id: walletA, organizationId: acmeId, now }).wallet,
    );
    deepStrictEqual(
      (await first.findOne(WalletSpecifications.forOrganization(betaId))).unwrap(),
      null,
    );
    deepStrictEqual(
      (
        await new WalletRepositoryFake().findOne(WalletSpecifications.forOrganization(acmeId))
      ).unwrap(),
      null,
    );
  });

  it("deletes the org's wallet and reports WalletNotFound when there is none", async () => {
    const repo = new WalletRepositoryFake();
    await repo.insertOne(WalletRootOps.create({ id: walletA, organizationId: acmeId, now }).wallet);
    (await repo.deleteOne(acmeId)).unwrap();
    deepStrictEqual(
      (await repo.findOne(WalletSpecifications.forOrganization(acmeId))).unwrap(),
      null,
    );
    deepStrictEqual(
      { ...(await repo.deleteOne(acmeId)).unwrapErr() },
      { _tag: "WalletNotFound", organizationId: acmeId },
    );
  });
});
