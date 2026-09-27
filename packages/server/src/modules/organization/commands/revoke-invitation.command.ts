import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { InvitationId } from "@/platform/ids/invitation-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationNotFound,
} from "../domain/invitation/invitation.errors.js";

export type RevokeInvitationPayload = {
  readonly invitationId: InvitationId;
  readonly actorUserId: UserId;
};

export type RevokeInvitationResult = Result<
  void,
  InvitationNotFound | InvitationAlreadyAccepted | InvitationAlreadyRevoked | PersistenceUnavailable
>;

export class RevokeInvitationCommand extends Command<RevokeInvitationResult> {
  constructor(public readonly payload: RevokeInvitationPayload) {
    super();
  }
}
