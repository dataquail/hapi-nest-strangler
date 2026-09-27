import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { ApiTokenRoot } from "../domain/api-token/api-token.root.js";

export type MintApiTokenPayload = {
  readonly userId: UserId;
  readonly label: string;
  readonly expiresInDays: number;
};

// The plaintext token is returned exactly once; only its hash is persisted.
export type MintApiTokenView = { readonly apiToken: ApiTokenRoot; readonly token: string };

export type MintApiTokenResult = Result<MintApiTokenView, PersistenceUnavailable>;

export class MintApiTokenCommand extends Command<MintApiTokenResult> {
  constructor(public readonly payload: MintApiTokenPayload) {
    super();
  }
}
