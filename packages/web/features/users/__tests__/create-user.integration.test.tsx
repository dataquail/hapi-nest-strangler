// Integration tier: the real CreateUser + UserList pair over MSW. What this
// proves that the ViewModel tests do not: the mutation flows through the real
// client, the toast reaches the DOM through the bridge and `<Toaster />`, and
// the invalidation refires UserList's suspense query.

import { rtlUsersDriver } from "@org/test-drivers/adapters/rtl/users-page-driver";
import * as React from "react";
import { describe, it } from "vitest";

import { CreateUser } from "@/features/users/create-user/create-user.view";
import { UserList } from "@/features/users/user-list.view";
import { makeUser } from "@/test/fixtures";
import { handlers } from "@/test/handlers";
import { renderWithHarness } from "@/test/integration-harness";
import { server } from "@/test/msw-server";

const TestUsersPage: React.FC = () => (
  <div>
    <CreateUser />
    <React.Suspense fallback={<div data-testid="users-loading" />}>
      <UserList />
    </React.Suspense>
  </div>
);

const validPayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
} as const;

describe("UsersPage — integration tier", () => {
  it("creates a user and surfaces the success toast", async () => {
    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list([]),
      handlers.users.create({ result: "success" }),
    );

    const driver = rtlUsersDriver(renderWithHarness(<TestUsersPage />));
    await driver.goto();
    await driver.createUser(validPayload);
    await driver.expectToast("success", "User created!");
  });

  it("surfaces the server's UserAlreadyExistsError message", async () => {
    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list([]),
      handlers.users.create({
        result: "UserAlreadyExistsError",
        message: "That email is already taken.",
      }),
    );

    const driver = rtlUsersDriver(renderWithHarness(<TestUsersPage />));
    await driver.goto();
    await driver.createUser(validPayload);
    await driver.expectToast("error", "That email is already taken.");
  });

  it("shows the new user in the list after creation", async () => {
    const newUser = makeUser({ email: validPayload.email });
    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list([]),
      handlers.users.create({ result: "success", id: newUser.id }),
    );

    const driver = rtlUsersDriver(renderWithHarness(<TestUsersPage />));
    await driver.goto();
    // The create invalidates the users query; the refetch must see the new user.
    server.use(handlers.users.list([newUser]));

    await driver.createUser(validPayload);
    await driver.expectUserInList(validPayload.email);
  });
});
