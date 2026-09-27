import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type {
  InvitationAlreadyAccepted,
  InvitationExpired,
  InvitationRevoked,
  InvitationTokenNotFound,
} from "../domain/invitation/invitation.errors.js";
import type { SuperAdminCannotOwnOrganization } from "../domain/organization/organization.errors.js";

export type AcceptInvitationPayload = { readonly token: string; readonly userId: UserId };

export type AcceptInvitationResult = Result<
  OrganizationId,
  | InvitationTokenNotFound
  | InvitationAlreadyAccepted
  | InvitationRevoked
  | InvitationExpired
  | SuperAdminCannotOwnOrganization
  | PersistenceUnavailable
>;

export class AcceptInvitationCommand extends Command<AcceptInvitationResult> {
  constructor(public readonly payload: AcceptInvitationPayload) {
    super();
  }
}
