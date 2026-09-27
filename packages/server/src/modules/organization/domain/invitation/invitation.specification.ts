import {
  type Predicate,
  Spec,
  type Specification,
} from "@/platform/ddd/contracts/specification.js";
import type { InvitationId } from "@/platform/ids/invitation-id.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { InvitationRoot } from "./invitation.root.js";

const withId = (id: InvitationId): Specification<InvitationRoot> =>
  Spec.eq<InvitationRoot, "id">("id", id);
const withToken = (token: string): Specification<InvitationRoot> =>
  Spec.eq<InvitationRoot, "token">("token", token);
const forOrganization = (organizationId: OrganizationId): Specification<InvitationRoot> =>
  Spec.eq<InvitationRoot, "organizationId">("organizationId", organizationId);
const withInviteeEmail = (inviteeEmail: string): Specification<InvitationRoot> =>
  Spec.eq<InvitationRoot, "inviteeEmail">("inviteeEmail", inviteeEmail);

const isAccepted = Spec.isNotNull<InvitationRoot>("acceptedAt");
const isRevoked = Spec.isNotNull<InvitationRoot>("revokedAt");
const isOpen = Spec.not(Spec.or(isAccepted, isRevoked));

const isExpiredAt =
  (now: Date): Predicate<InvitationRoot> =>
  (invitation) =>
    invitation.expiresAt.getTime() <= now.getTime();

export type InvitationStatus = "pending" | "expired";

const statusAt = (invitation: InvitationRoot, now: Date): InvitationStatus =>
  isExpiredAt(now)(invitation) ? "expired" : "pending";

export const InvitationSpecifications = {
  withId,
  withToken,
  forOrganization,
  withInviteeEmail,
  isAccepted,
  isRevoked,
  isOpen,
  isExpiredAt,
  statusAt,
} as const;
