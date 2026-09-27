import { playwrightUsersDriver } from "@org/test-drivers/adapters/playwright/users-page-driver";
import { test } from "@playwright/test";

import { DEFAULT_DATABASE_URL_TEST, truncate } from "@/test-utils/database";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST ?? DEFAULT_DATABASE_URL_TEST;

test.beforeEach(async () => {
  // Initialize state at the start of each spec: state initialization, not
  // cleanup. Users and wallets together so no wallet outlives the
  // organization that owned it.
  await truncate(DATABASE_URL_TEST, ["wallet.wallets", "public.users"]);
});

test("a user can be created from the users page", async ({ page }) => {
  const users = playwrightUsersDriver(page);
  await users.goto();

  await users.createUser({
    email: "alice@example.com",
    country: "USA",
    street: "123 Main St",
    postalCode: "12345",
  });

  await users.expectUserInList("alice@example.com");
});
