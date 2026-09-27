import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

export type StartDeviceGrantPayload = { readonly ttlSeconds: number };

// The plaintext deviceCode is returned to the CLI once; only its hash is stored.
export type StartDeviceGrantView = {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly expiresAt: Date;
};

export type StartDeviceGrantResult = Result<StartDeviceGrantView, PersistenceUnavailable>;

export class StartDeviceGrantCommand extends Command<StartDeviceGrantResult> {
  constructor(public readonly payload: StartDeviceGrantPayload) {
    super();
  }
}
