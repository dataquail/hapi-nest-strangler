import { deepStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, truncate } from "@/test-utils/test-database.js";

import { WalletId } from "../domain/wallet/wallet.id.js";
import { WalletRootOps } from "../domain/wallet/wallet.root-ops.js";
import { WalletRepositoryLive } from "../infrastructure/repositories/wallet.repository-live.js";
import { FindWalletByOrganizationHandler } from "./find-wallet-by-organization.handler.js";
import { FindWalletByOrganizationQuery } from "./find-wallet-by-organization.query.js";

const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const otherOrgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const walletId = WalletId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

describe.sequential("FindWalletByOrganizationHandler (integration)", () => {
  let db: Database;
  let handler: FindWalletByOrganizationHandler;

  beforeAll(async () => {
    db = await createTestDatabase();
    handler = new FindWalletByOrganizationHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "wallet.wallets");
    (
      await new WalletRepositoryLive(db).insertOne(
        WalletRootOps.create({ id: walletId, organizationId, now: new Date() }).wallet,
      )
    ).unwrap();
  });

  it("projects the organization's wallet", async () => {
    const view = (
      await handler.execute(new FindWalletByOrganizationQuery({ organizationId }))
    ).unwrap();
    deepStrictEqual(view, { id: walletId, organizationId, balance: 0 });
  });

  it("returns null for an organization without a wallet", async () => {
    const view = (
      await handler.execute(new FindWalletByOrganizationQuery({ organizationId: otherOrgId }))
    ).unwrap();
    deepStrictEqual(view, null);
  });
});
