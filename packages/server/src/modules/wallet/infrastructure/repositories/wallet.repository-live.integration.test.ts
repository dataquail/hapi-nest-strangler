import { deepStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { WalletRootOps } from "@/modules/wallet/domain/wallet/wallet.root-ops.js";
import { WalletSpecifications } from "@/modules/wallet/domain/wallet/wallet.specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { WalletRepositoryLive } from "./wallet.repository-live.js";

const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const otherOrgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const walletId = WalletId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherWalletId = WalletId.parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = new Date("2025-01-01T00:00:00Z");

const acmeWallet = WalletRootOps.create({ id: walletId, organizationId, now }).wallet;

// No organization row is seeded: the organization lives in the legacy API's
// database, and the wallet table carries no foreign key to it.
describe.sequential("WalletRepositoryLive (integration)", () => {
  let db: Database;
  let repo: WalletRepositoryLive;

  beforeAll(async () => {
    db = await createTestDatabase();
    repo = new WalletRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "wallet.wallets");
  });

  it("persists the wallet and decodes it back via findOne", async () => {
    (await repo.insertOne(acmeWallet)).unwrap();
    const found = (
      await repo.findOne(WalletSpecifications.forOrganization(organizationId))
    ).unwrap();
    deepStrictEqual(found, acmeWallet);
  });

  it("fails WalletAlreadyExistsForOrganization on a duplicate organization_id", async () => {
    (await repo.insertOne(acmeWallet)).unwrap();
    const clashing = WalletRootOps.create({ id: otherWalletId, organizationId, now }).wallet;
    const result = await repo.insertOne(clashing);
    deepStrictEqual(
      { ...result.unwrapErr() },
      { _tag: "WalletAlreadyExistsForOrganization", organizationId },
    );
  });

  it("returns null when no wallet exists for the org", async () => {
    deepStrictEqual(
      (await repo.findOne(WalletSpecifications.forOrganization(otherOrgId))).unwrap(),
      null,
    );
  });

  it("deletes the org's wallet and reports WalletNotFound when there is none", async () => {
    (await repo.insertOne(acmeWallet)).unwrap();
    (await repo.deleteOne(organizationId)).unwrap();
    deepStrictEqual(
      (await repo.findOne(WalletSpecifications.forOrganization(organizationId))).unwrap(),
      null,
    );
    deepStrictEqual(
      { ...(await repo.deleteOne(organizationId)).unwrapErr() },
      { _tag: "WalletNotFound", organizationId },
    );
  });
});
