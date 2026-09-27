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

export type ResendInvitationPayload = {
  readonly invitationId: InvitationId;
  readonly ttlSeconds: number;
  readonly actorUserId: UserId;
};

export type ResendInvitationResult = Result<
  void,
  InvitationNotFound | InvitationAlreadyAccepted | InvitationAlreadyRevoked | PersistenceUnavailable
>;

export class ResendInvitationCommand extends Command<ResendInvitationResult> {
  constructor(public readonly payload: ResendInvitationPayload) {
    super();
  }
}
