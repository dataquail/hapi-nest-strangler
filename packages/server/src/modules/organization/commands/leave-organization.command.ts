import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { MembershipNotFound } from "../domain/membership/membership.errors.js";

export type LeaveOrganizationPayload = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
};

export type LeaveOrganizationResult = Result<void, MembershipNotFound | PersistenceUnavailable>;

export class LeaveOrganizationCommand extends Command<LeaveOrganizationResult> {
  constructor(public readonly payload: LeaveOrganizationPayload) {
    super();
  }
}
