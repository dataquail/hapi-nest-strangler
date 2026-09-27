import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

import type {
  DeviceGrantExpired,
  DeviceGrantNotFound,
  DeviceGrantPending,
} from "../domain/device-grant/device-grant.errors.js";
import type { MintApiTokenView } from "./mint-api-token.command.js";

// CLI poll: exchange a device code for a token once the grant is approved.
export type PollDeviceGrantPayload = {
  readonly deviceCode: string;
  readonly tokenExpiresInDays: number;
};

export type PollDeviceGrantResult = Result<
  MintApiTokenView,
  DeviceGrantNotFound | DeviceGrantExpired | DeviceGrantPending | PersistenceUnavailable
>;

export class PollDeviceGrantCommand extends Command<PollDeviceGrantResult> {
  constructor(public readonly payload: PollDeviceGrantPayload) {
    super();
  }
}
