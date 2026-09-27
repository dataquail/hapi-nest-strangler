import { Err, Ok, type Result } from "oxide.ts";

import type { DomainEvent } from "@/platform/ddd/contracts/domain-event.js";

import type {
  InvitationAlreadyAccepted,
  InvitationExpired,
  InvitationRevoked,
} from "../invitation/invitation.errors.js";
import type { InvitationRoot } from "../invitation/invitation.root.js";
import { type AcceptInput, InvitationRootOps } from "../invitation/invitation.root-ops.js";
import type { MembershipRoot } from "../membership/membership.root.js";
import { MembershipRootOps } from "../membership/membership.root-ops.js";

export type AcceptanceOutcome = {
  readonly invitation: InvitationRoot;
  readonly membership: MembershipRoot;
  readonly events: ReadonlyArray<DomainEvent>;
};

// Accepting an invitation spans two aggregates — the invitation closes and a
// membership opens — which is what makes it a domain service (ADR-0023).
const accept = (
  invitation: InvitationRoot,
  input: AcceptInput,
): Result<AcceptanceOutcome, InvitationAlreadyAccepted | InvitationRevoked | InvitationExpired> => {
  const accepted = InvitationRootOps.accept(invitation, input);
  if (accepted.isErr()) return Err(accepted.unwrapErr());
  const { events: membershipEvents, membership } = MembershipRootOps.create({
    userId: input.userId,
    organizationId: invitation.organizationId,
    now: input.now,
  });
  return Ok({
    invitation: accepted.unwrap().invitation,
    membership,
    events: [...accepted.unwrap().events, ...membershipEvents],
  });
};

export const InvitationAcceptance = { accept } as const;
