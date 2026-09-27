import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { InvitationId } from "@/platform/ids/invitation-id.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

export type PendingInvitationStatus = "pending" | "expired";

export type PendingInvitationView = {
  readonly invitationId: InvitationId;
  readonly inviteeEmail: string;
  readonly status: PendingInvitationStatus;
  readonly expiresAt: Date;
  readonly createdAt: Date;
};

export type FindPendingInvitationsPayload = { readonly organizationId: OrganizationId };

export type FindPendingInvitationsResult = Result<
  ReadonlyArray<PendingInvitationView>,
  PersistenceUnavailable
>;

export class FindPendingInvitationsQuery extends Query<FindPendingInvitationsResult> {
  constructor(public readonly payload: FindPendingInvitationsPayload) {
    super();
  }
}
