import type { AuthContract } from "@org/contracts/api/Contracts";
import { UserId } from "@org/contracts/EntityIds";

const DEFAULT_USER_ID = UserId.parse("11111111-1111-1111-1111-111111111111");

/** What `/auth/me` returns when signed in. */
export const makeCurrentUser = (
  overrides: Partial<AuthContract.CurrentUserResponse> = {},
): AuthContract.CurrentUserResponse => ({
  userId: DEFAULT_USER_ID,
  isSuperAdmin: false,
  ...overrides,
});
