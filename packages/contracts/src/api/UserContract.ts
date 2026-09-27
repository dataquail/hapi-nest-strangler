import { z } from "zod";

import { UserId } from "../EntityIds.js";
import { defineError, ServiceUnavailable } from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const UserAlreadyExistsError = defineError(
  "UserAlreadyExistsError",
  409,
  { email: z.string(), message: z.string() },
  "A user with that email already exists",
);

export const UserNotFoundError = defineError(
  "UserNotFoundError",
  404,
  { userId: UserId, message: z.string() },
  "No user with that id",
);

export const Address = z
  .object({
    country: z.string(),
    street: z.string(),
    postalCode: z.string(),
  })
  .meta({ id: "Address" });
export type Address = z.infer<typeof Address>;

export const User = z
  .object({
    id: UserId,
    email: z.string(),
    address: Address.nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "User" });
export type User = z.infer<typeof User>;

export const CreateUserPayload = z
  .object({
    email: z.string().min(3).max(255),
    country: z.string().min(2).max(50),
    street: z.string().min(2).max(50),
    postalCode: z.string().min(2).max(10),
  })
  .meta({ id: "CreateUserPayload" });
export type CreateUserPayload = z.infer<typeof CreateUserPayload>;

export const CreateUserResponse = z.object({ id: UserId }).meta({ id: "CreateUserResponse" });
export type CreateUserResponse = z.infer<typeof CreateUserResponse>;

export const FindUsersParams = z
  .object({
    page: z.coerce.number().int().min(1),
    pageSize: z.coerce.number().int().min(1).max(100),
  })
  .meta({ id: "FindUsersParams" });
export type FindUsersParams = z.infer<typeof FindUsersParams>;

export const PaginatedUsers = z
  .object({
    users: z.array(User),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
  })
  .meta({ id: "PaginatedUsers" });
export type PaginatedUsers = z.infer<typeof PaginatedUsers>;

export const Group = defineGroup({
  name: "user",
  routes: {
    find: defineRoute({
      method: "get",
      path: "/users",
      operationId: "user.find",
      query: FindUsersParams,
      success: { status: 200, schema: PaginatedUsers },
      errors: [ServiceUnavailable],
      security: "session",
    }),
    create: defineRoute({
      method: "post",
      path: "/users",
      operationId: "user.create",
      body: CreateUserPayload,
      success: { status: 201, schema: CreateUserResponse },
      errors: [UserAlreadyExistsError, ServiceUnavailable],
      security: "session",
    }),
    delete: defineRoute({
      method: "delete",
      path: "/users/{id}",
      operationId: "user.delete",
      params: z.object({ id: UserId }),
      success: { status: 204, schema: undefined },
      errors: [UserNotFoundError, ServiceUnavailable],
      security: "session",
    }),
  },
});
