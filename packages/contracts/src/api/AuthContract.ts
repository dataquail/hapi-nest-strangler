import { z } from "zod";

import { ApiTokenId, UserId } from "../EntityIds.js";
import {
  Gone,
  InternalServerError,
  NotFound,
  ServiceUnavailable,
  Unauthorized,
} from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const CurrentUserResponse = z
  .object({ userId: UserId, isSuperAdmin: z.boolean() })
  .meta({ id: "CurrentUserResponse" });
export type CurrentUserResponse = z.infer<typeof CurrentUserResponse>;

export const CallbackParams = z
  .object({
    code: z.string().optional(),
    state: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
  })
  .meta({ id: "CallbackParams" });
export type CallbackParams = z.infer<typeof CallbackParams>;

export const PublicGroup = defineGroup({
  name: "auth",
  routes: {
    login: defineRoute({
      method: "get",
      path: "/auth/login",
      operationId: "auth.login",
      summary: "Starts the OIDC authorization-code flow and redirects to the identity provider",
      success: { status: 302, schema: undefined },
      errors: [InternalServerError, ServiceUnavailable],
      security: "public",
    }),
    callback: defineRoute({
      method: "get",
      path: "/auth/callback",
      operationId: "auth.callback",
      query: CallbackParams,
      success: { status: 302, schema: undefined },
      errors: [Unauthorized, InternalServerError, ServiceUnavailable],
      security: "public",
    }),
    logout: defineRoute({
      method: "get",
      path: "/auth/logout",
      operationId: "auth.logout",
      success: { status: 302, schema: undefined },
      errors: [InternalServerError, ServiceUnavailable],
      security: "public",
    }),
  },
});

export const PrivateGroup = defineGroup({
  name: "authSession",
  routes: {
    me: defineRoute({
      method: "get",
      path: "/auth/me",
      operationId: "authSession.me",
      success: { status: 200, schema: CurrentUserResponse },
      errors: [ServiceUnavailable],
      security: "session",
    }),
  },
});

export const ApiTokenSummary = z
  .object({
    id: ApiTokenId,
    label: z.string(),
    prefix: z.string(),
    expiresAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    lastUsedAt: z.iso.datetime(),
  })
  .meta({ id: "ApiTokenSummary" });
export type ApiTokenSummary = z.infer<typeof ApiTokenSummary>;

export const CreateApiTokenPayload = z
  .object({
    label: z.string().min(1).max(255),
    expiresInDays: z.number().int().min(1).max(3650).optional(),
  })
  .meta({ id: "CreateApiTokenPayload" });
export type CreateApiTokenPayload = z.infer<typeof CreateApiTokenPayload>;

export const CreateApiTokenResponse = z
  .object({
    id: ApiTokenId,
    token: z.string(),
    prefix: z.string(),
    expiresAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "CreateApiTokenResponse" });
export type CreateApiTokenResponse = z.infer<typeof CreateApiTokenResponse>;

export const DeviceApprovalPayload = z
  .object({ userCode: z.string().min(1).max(32) })
  .meta({ id: "DeviceApprovalPayload" });
export type DeviceApprovalPayload = z.infer<typeof DeviceApprovalPayload>;

export const DeviceApprovalGroup = defineGroup({
  name: "authDevice",
  routes: {
    approve: defineRoute({
      method: "post",
      path: "/auth/device/approve",
      operationId: "authDevice.approve",
      body: DeviceApprovalPayload,
      success: { status: 204, schema: undefined },
      errors: [NotFound, Gone, ServiceUnavailable],
      security: "session",
    }),
  },
});

export const TokensGroup = defineGroup({
  name: "authTokens",
  routes: {
    create: defineRoute({
      method: "post",
      path: "/auth/tokens",
      operationId: "authTokens.create",
      body: CreateApiTokenPayload,
      success: { status: 201, schema: CreateApiTokenResponse },
      errors: [ServiceUnavailable],
      security: "session",
    }),
    list: defineRoute({
      method: "get",
      path: "/auth/tokens",
      operationId: "authTokens.list",
      success: { status: 200, schema: z.array(ApiTokenSummary) },
      errors: [ServiceUnavailable],
      security: "session",
    }),
    revoke: defineRoute({
      method: "delete",
      path: "/auth/tokens/{id}",
      operationId: "authTokens.revoke",
      params: z.object({ id: ApiTokenId }),
      success: { status: 204, schema: undefined },
      errors: [NotFound, ServiceUnavailable],
      security: "session",
    }),
  },
});
