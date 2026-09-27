import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletId } from "../domain/wallet/wallet.id.js";
import { WalletRootOps } from "../domain/wallet/wallet.root-ops.js";
import { WalletSpecifications } from "../domain/wallet/wallet.specification.js";
import { WalletRepositoryFake } from "../infrastructure/repositories/wallet.repository-fake.js";
import { DeleteWalletCommand } from "./delete-wallet.command.js";
import { DeleteWalletHandler } from "./delete-wallet.handler.js";

const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const walletId = WalletId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

describe("DeleteWalletHandler", () => {
  it("removes the organization's wallet", async () => {
    const wallets = new WalletRepositoryFake();
    await wallets.insertOne(
      WalletRootOps.create({ id: walletId, organizationId, now: new Date() }).wallet,
    );
    const handler = new DeleteWalletHandler(wallets, PassThroughUnitOfWork);
    (await handler.execute(new DeleteWalletCommand({ organizationId }))).unwrap();
    deepStrictEqual(
      (await wallets.findOne(WalletSpecifications.forOrganization(organizationId))).unwrap(),
      null,
    );
  });

  it("is idempotent: deleting a wallet that does not exist succeeds", async () => {
    const handler = new DeleteWalletHandler(new WalletRepositoryFake(), PassThroughUnitOfWork);
    const result = await handler.execute(new DeleteWalletCommand({ organizationId }));
    deepStrictEqual(result.isOk(), true);
  });
});
