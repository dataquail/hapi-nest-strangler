import { expect, test } from "@playwright/test";

import { RootPage } from "@/drivers/pages/root-page";
import { countWalletsFor, DEFAULT_DATABASE_URL_TEST } from "@/test-utils/database";
import { MEMBER_STORAGE_STATE } from "@/test-utils/member-credentials";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST ?? DEFAULT_DATABASE_URL_TEST;

// The seam between the two servers (ADR-0034): the legacy API creates the
// organization and, inside that transaction, asks the Nest server to open
// its wallet. A brand-new organization has no prior state, so nothing is
// truncated; the wallet row is the only thing the browser cannot see.
test.use({ storageState: MEMBER_STORAGE_STATE });

test("creating an organization opens its wallet on the Nest server", async ({ page }) => {
  const root = new RootPage(page);
  await root.visit();

  const orgId = await root.createOrg(`Acme ${Date.now()}`);

  expect(await countWalletsFor(DATABASE_URL_TEST, orgId)).toBe(1);
});
