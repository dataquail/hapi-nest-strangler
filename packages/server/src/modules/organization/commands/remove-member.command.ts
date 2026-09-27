import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { MembershipNotFound } from "../domain/membership/membership.errors.js";

export type RemoveMemberPayload = {
  readonly targetUserId: UserId;
  readonly organizationId: OrganizationId;
  readonly actorUserId: UserId;
};

export type RemoveMemberResult = Result<void, MembershipNotFound | PersistenceUnavailable>;

export class RemoveMemberCommand extends Command<RemoveMemberResult> {
  constructor(public readonly payload: RemoveMemberPayload) {
    super();
  }
}
