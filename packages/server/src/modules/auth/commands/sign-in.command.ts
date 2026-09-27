import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type {
  IdentityEmailAlreadyRegistered,
  IdentityMissingEmail,
} from "../domain/auth-identity/auth-identity.errors.js";
import type { SessionId } from "../domain/session/session.id.js";

export type SignInView = { readonly sessionId: SessionId; readonly userId: UserId };

// A verified IdP subject plus the email needed to JIT-provision an unknown one.
export type SignInPayload = {
  readonly subject: string;
  readonly email: string | null;
  readonly ttlSeconds: number;
  readonly absoluteTtlSeconds: number;
};

export type SignInResult = Result<
  SignInView,
  IdentityMissingEmail | IdentityEmailAlreadyRegistered | PersistenceUnavailable
>;

export class SignInCommand extends Command<SignInResult> {
  constructor(public readonly payload: SignInPayload) {
    super();
  }
}
