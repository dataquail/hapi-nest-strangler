import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type {
  DeviceGrantExpired,
  DeviceGrantNotFound,
} from "../domain/device-grant/device-grant.errors.js";

// Browser-side approval: the signed-in user submits the code the CLI showed them.
export type ApproveDeviceGrantPayload = { readonly userCode: string; readonly userId: UserId };

export type ApproveDeviceGrantResult = Result<
  void,
  DeviceGrantNotFound | DeviceGrantExpired | PersistenceUnavailable
>;

export class ApproveDeviceGrantCommand extends Command<ApproveDeviceGrantResult> {
  constructor(public readonly payload: ApproveDeviceGrantPayload) {
    super();
  }
}
