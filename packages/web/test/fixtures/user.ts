import type { UserContract } from "@org/contracts/api/Contracts";
import { UserId } from "@org/contracts/EntityIds";

const FIXED_DATE = "2026-01-01T00:00:00.000Z";

const DEFAULT_USER_ID = UserId.parse("11111111-1111-1111-1111-111111111111");

export const makeUser = (overrides: Partial<UserContract.User> = {}): UserContract.User => ({
  id: DEFAULT_USER_ID,
  email: "alice@example.com",
  address: { country: "US", street: "1 A St", postalCode: "10001" },
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  ...overrides,
});

/** A page of users; `users` defaults to a single `makeUser()`. */
export const makePaginatedUsers = (
  overrides: Partial<UserContract.PaginatedUsers> = {},
): UserContract.PaginatedUsers => {
  const users = overrides.users ?? [makeUser()];
  return { users, page: 1, pageSize: 10, total: users.length, ...overrides };
};

export const makeCreateUserPayload = (
  overrides: Partial<UserContract.CreateUserPayload> = {},
): UserContract.CreateUserPayload => ({
  email: "new-user@example.com",
  country: "US",
  street: "2 B St",
  postalCode: "10002",
  ...overrides,
});
