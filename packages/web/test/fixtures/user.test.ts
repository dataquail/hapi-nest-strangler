import { UserContract } from "@org/contracts/api/Contracts";
import { describe, expect, it } from "vitest";

import { makeCreateUserPayload, makePaginatedUsers, makeUser } from "./user";

describe("user fixtures", () => {
  it("makeUser() parses through UserContract.User", () => {
    expect(UserContract.User.parse(makeUser())).toBeDefined();
  });

  it("makeUser() honors overrides", () => {
    expect(makeUser({ email: "override@example.com" }).email).toBe("override@example.com");
  });

  it("makePaginatedUsers() parses through UserContract.PaginatedUsers", () => {
    expect(UserContract.PaginatedUsers.parse(makePaginatedUsers())).toBeDefined();
  });

  it("makePaginatedUsers() defaults total to users.length", () => {
    expect(makePaginatedUsers({ users: [makeUser(), makeUser()] }).total).toBe(2);
  });

  it("makeCreateUserPayload() parses through UserContract.CreateUserPayload", () => {
    expect(UserContract.CreateUserPayload.parse(makeCreateUserPayload())).toBeDefined();
  });
});
