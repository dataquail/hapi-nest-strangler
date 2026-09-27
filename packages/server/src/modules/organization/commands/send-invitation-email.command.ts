import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { InvitationId } from "@/platform/ids/invitation-id.js";

export type SendInvitationEmailPayload = { readonly invitationId: InvitationId };

export type SendInvitationEmailResult = Result<void, PersistenceUnavailable>;

export class SendInvitationEmailCommand extends Command<SendInvitationEmailResult> {
  constructor(public readonly payload: SendInvitationEmailPayload) {
    super();
  }
}
