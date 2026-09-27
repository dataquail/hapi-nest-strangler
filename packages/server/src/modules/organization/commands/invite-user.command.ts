import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { InvitationId } from "@/platform/ids/invitation-id.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

export type InviteUserPayload = {
  readonly organizationId: OrganizationId;
  readonly inviteeEmail: string;
  readonly ttlSeconds: number;
  readonly actorUserId: UserId;
};

export type InviteUserResult = Result<InvitationId, PersistenceUnavailable>;

export class InviteUserCommand extends Command<InviteUserResult> {
  constructor(public readonly payload: InviteUserPayload) {
    super();
  }
}
