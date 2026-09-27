import { UserId } from "@org/contracts/EntityIds";
import { rtlUsersDriver } from "@org/test-drivers/adapters/rtl/users-page-driver";
import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import * as React from "react";
import { describe, expect, it } from "vitest";

import { CreateUser } from "@/features/users/create-user/create-user.view";
import { UserList } from "@/features/users/user-list.view";
import { makePaginatedUsers, makeUser } from "@/test/fixtures";
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

describe("UserList — integration tier", () => {
  it("renders the empty state when the server returns zero users", async () => {
    server.use(handlers.auth.signedInAs(), handlers.users.list([]));

    renderWithHarness(<TestUsersPage />);

    expect(await screen.findByText("No users yet.")).toBeVisible();
    expect(screen.queryByTestId("user-list")).toBeNull();
  });

  it("renders pagination 'Page 1 of N' from the server's total, not the in-page count", async () => {
    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list(
        makePaginatedUsers({
          users: [
            makeUser({
              email: "a@example.com",
              id: UserId.parse("00000000-0000-0000-0000-000000000001"),
            }),
            makeUser({
              email: "b@example.com",
              id: UserId.parse("00000000-0000-0000-0000-000000000002"),
            }),
            makeUser({
              email: "c@example.com",
              id: UserId.parse("00000000-0000-0000-0000-000000000003"),
            }),
          ],
          page: 1,
          pageSize: 10,
          total: 25,
        }),
      ),
    );

    renderWithHarness(<TestUsersPage />);

    expect(await screen.findByText(/Page 1 of 3/)).toBeVisible();
    expect(screen.getByText(/25 total/)).toBeVisible();
  });

  it("refetches with page=2 when 'Next page' is clicked", async () => {
    const user = userEvent.setup();
    const page1 = [makeUser({ email: "alice@example.com" })];
    const page2 = [
      makeUser({
        email: "zoe@example.com",
        id: UserId.parse("00000000-0000-0000-0000-000000000099"),
      }),
    ];

    server.use(
      handlers.auth.signedInAs(),
      handlers.users.list(makePaginatedUsers({ users: page1, page: 1, pageSize: 10, total: 20 })),
    );

    const rendered = renderWithHarness(<TestUsersPage />);
    await rtlUsersDriver(rendered).goto();

    expect(await screen.findByText("alice@example.com")).toBeVisible();
    expect(screen.getByText(/Page 1 of 2/)).toBeVisible();

    server.use(
      handlers.users.list(makePaginatedUsers({ users: page2, page: 2, pageSize: 10, total: 20 })),
    );

    await user.click(screen.getByRole("button", { name: /next page/i }));

    expect(await screen.findByText("zoe@example.com")).toBeVisible();
    expect(screen.getByText(/Page 2 of 2/)).toBeVisible();
  });
});
