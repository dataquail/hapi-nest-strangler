import { Err, Ok, type Result } from "oxide.ts";

import type { InvitationId } from "@/platform/ids/invitation-id.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import {
  InvitationAlreadyAccepted,
  InvitationAlreadyRevoked,
  InvitationExpired,
  InvitationRevoked as InvitationRevokedError,
} from "./invitation.errors.js";
import {
  InvitationAccepted,
  type InvitationEvent,
  InvitationIssued,
  InvitationReissued,
  InvitationRevoked,
} from "./invitation.events.js";
import { InvitationRoot } from "./invitation.root.js";
import { InvitationSpecifications } from "./invitation.specification.js";

export type Outcome = {
  readonly invitation: InvitationRoot;
  readonly events: ReadonlyArray<InvitationEvent>;
};

export type IssueInput = {
  readonly id: InvitationId;
  readonly organizationId: OrganizationId;
  readonly inviteeEmail: string;
  readonly token: string;
  readonly expiresAt: Date;
  readonly now: Date;
};

const issue = (input: IssueInput): Outcome => {
  const invitation = InvitationRoot.parse({
    id: input.id,
    organizationId: input.organizationId,
    inviteeEmail: input.inviteeEmail,
    token: input.token,
    expiresAt: input.expiresAt,
    acceptedAt: null,
    revokedAt: null,
    createdAt: input.now,
  });
  return {
    invitation,
    events: [
      InvitationIssued.make({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        inviteeEmail: invitation.inviteeEmail,
      }),
    ],
  };
};

export type AcceptInput = { readonly userId: UserId; readonly now: Date };

const accept = (
  invitation: InvitationRoot,
  input: AcceptInput,
): Result<Outcome, InvitationAlreadyAccepted | InvitationRevokedError | InvitationExpired> => {
  if (InvitationSpecifications.isAccepted(invitation)) {
    return Err(new InvitationAlreadyAccepted({ invitationId: invitation.id }));
  }
  if (InvitationSpecifications.isRevoked(invitation)) {
    return Err(new InvitationRevokedError({ invitationId: invitation.id }));
  }
  if (InvitationSpecifications.isExpiredAt(input.now)(invitation)) {
    return Err(new InvitationExpired({ invitationId: invitation.id }));
  }
  return Ok({
    invitation: InvitationRoot.parse({ ...invitation, acceptedAt: input.now, revokedAt: null }),
    events: [
      InvitationAccepted.make({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        userId: input.userId,
      }),
    ],
  });
};

export type RevokeInput = { readonly now: Date };

const revoke = (
  invitation: InvitationRoot,
  input: RevokeInput,
): Result<Outcome, InvitationAlreadyAccepted | InvitationAlreadyRevoked> => {
  if (InvitationSpecifications.isAccepted(invitation)) {
    return Err(new InvitationAlreadyAccepted({ invitationId: invitation.id }));
  }
  if (InvitationSpecifications.isRevoked(invitation)) {
    return Err(new InvitationAlreadyRevoked({ invitationId: invitation.id }));
  }
  return Ok({
    invitation: InvitationRoot.parse({ ...invitation, acceptedAt: null, revokedAt: input.now }),
    events: [
      InvitationRevoked.make({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
      }),
    ],
  });
};

export type ReissueInput = { readonly token: string; readonly expiresAt: Date; readonly now: Date };

const reissue = (
  invitation: InvitationRoot,
  input: ReissueInput,
): Result<Outcome, InvitationAlreadyAccepted | InvitationAlreadyRevoked> => {
  if (InvitationSpecifications.isAccepted(invitation)) {
    return Err(new InvitationAlreadyAccepted({ invitationId: invitation.id }));
  }
  if (InvitationSpecifications.isRevoked(invitation)) {
    return Err(new InvitationAlreadyRevoked({ invitationId: invitation.id }));
  }
  return Ok({
    invitation: InvitationRoot.parse({
      ...invitation,
      token: input.token,
      expiresAt: input.expiresAt,
      acceptedAt: null,
      revokedAt: null,
    }),
    events: [
      InvitationReissued.make({
        invitationId: invitation.id,
        organizationId: invitation.organizationId,
        inviteeEmail: invitation.inviteeEmail,
      }),
    ],
  });
};

export const InvitationRootOps = { issue, accept, revoke, reissue } as const;
