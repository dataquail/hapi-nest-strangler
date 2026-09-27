import { UserContract } from "@org/contracts/api/Contracts";
import type { UserId } from "@org/contracts/EntityIds";

import { makePaginatedUsers, makeUser } from "../fixtures/user";
import { fail, ok, typedHandler } from "../typed-handler";

const routes = UserContract.Group.routes;

const isPage = (
  arg: ReadonlyArray<UserContract.User> | UserContract.PaginatedUsers,
): arg is UserContract.PaginatedUsers => !Array.isArray(arg);

export const usersHandlers = {
  /** GET /users: a page built from whatever the test passed. */
  list: (arg: ReadonlyArray<UserContract.User> | UserContract.PaginatedUsers = []) =>
    typedHandler(routes.find, ({ urlParams }) =>
      ok(
        isPage(arg)
          ? arg
          : makePaginatedUsers({
              users: [...arg],
              page: urlParams.page,
              pageSize: urlParams.pageSize,
              total: arg.length,
            }),
      ),
    ),

  create: (
    outcome:
      | { readonly result: "success"; readonly id?: UserId }
      | { readonly result: "UserAlreadyExistsError"; readonly message?: string },
  ) =>
    typedHandler(routes.create, ({ payload }) =>
      outcome.result === "success"
        ? ok({ id: outcome.id ?? makeUser().id })
        : fail(UserContract.UserAlreadyExistsError, {
            email: payload.email,
            message: outcome.message ?? "A user with that email already exists.",
          }),
    ),

  delete: (outcome: { readonly result: "success" | "UserNotFoundError" }) =>
    typedHandler(routes.delete, ({ path }) =>
      outcome.result === "success"
        ? ok(undefined)
        : fail(UserContract.UserNotFoundError, { userId: path.id, message: "User not found." }),
    ),
};
