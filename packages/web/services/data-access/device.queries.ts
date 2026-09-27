// Browser-side approval of a CLI device grant: bind the grant identified by
// `userCode` to the signed-in caller. Nothing to read here; one write.

import type { AuthContract } from "@org/contracts/api/Contracts";

import { unwrap } from "../api/api-error";
import { type ApiClient, getApiClient } from "../api/client.shared";

export const approveDevice = async (
  payload: AuthContract.DeviceApprovalPayload,
  client: ApiClient = getApiClient(),
): Promise<void> => {
  unwrap(await client.POST("/auth/device/approve", { body: payload }));
};
