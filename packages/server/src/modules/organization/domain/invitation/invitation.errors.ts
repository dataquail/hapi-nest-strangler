import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { InvitationId } from "@/platform/ids/invitation-id.js";

export class InvitationNotFound extends TaggedError("InvitationNotFound")<{
  readonly invitationId: InvitationId;
}> {}

export class InvitationTokenNotFound extends TaggedError("InvitationTokenNotFound") {}

export class InvitationExpired extends TaggedError("InvitationExpired")<{
  readonly invitationId: InvitationId;
}> {}

export class InvitationAlreadyAccepted extends TaggedError("InvitationAlreadyAccepted")<{
  readonly invitationId: InvitationId;
}> {}

export class InvitationAlreadyRevoked extends TaggedError("InvitationAlreadyRevoked")<{
  readonly invitationId: InvitationId;
}> {}

export class InvitationRevoked extends TaggedError("InvitationRevoked")<{
  readonly invitationId: InvitationId;
}> {}
