import { z } from "zod";

import { defineError, ServiceUnavailable } from "../HttpErrors.js";
import { defineGroup, defineRoute } from "../Route.js";

export const DeviceStartResponse = z
  .object({
    device_code: z.string(),
    user_code: z.string(),
    verification_uri: z.string(),
    verification_uri_complete: z.string(),
    interval: z.number(),
    expires_in: z.number(),
  })
  .meta({ id: "DeviceStartResponse" });
export type DeviceStartResponse = z.infer<typeof DeviceStartResponse>;

export const DeviceTokenPayload = z
  .object({ device_code: z.string() })
  .meta({ id: "DeviceTokenPayload" });
export type DeviceTokenPayload = z.infer<typeof DeviceTokenPayload>;

export const DeviceTokenResponse = z
  .object({
    access_token: z.string(),
    token_type: z.literal("Bearer"),
    expires_at: z.iso.datetime().nullable(),
  })
  .meta({ id: "DeviceTokenResponse" });
export type DeviceTokenResponse = z.infer<typeof DeviceTokenResponse>;

export const DeviceAuthorizationPending = defineError(
  "DeviceAuthorizationPending",
  400,
  { message: z.string() },
  "The user has not approved the device yet",
);
export const DeviceTokenExpired = defineError(
  "DeviceTokenExpired",
  400,
  { message: z.string() },
  "The device code has expired",
);
export const DeviceCodeNotFound = defineError(
  "DeviceCodeNotFound",
  400,
  { message: z.string() },
  "No such device code",
);

export const DeviceGroup = defineGroup({
  name: "cliAuth",
  routes: {
    deviceStart: defineRoute({
      method: "post",
      path: "/cli/device/start",
      operationId: "cliAuth.deviceStart",
      success: { status: 201, schema: DeviceStartResponse },
      errors: [ServiceUnavailable],
      security: "public",
    }),
    deviceToken: defineRoute({
      method: "post",
      path: "/cli/device/token",
      operationId: "cliAuth.deviceToken",
      body: DeviceTokenPayload,
      success: { status: 200, schema: DeviceTokenResponse },
      errors: [
        DeviceAuthorizationPending,
        DeviceTokenExpired,
        DeviceCodeNotFound,
        ServiceUnavailable,
      ],
      security: "public",
    }),
  },
});
