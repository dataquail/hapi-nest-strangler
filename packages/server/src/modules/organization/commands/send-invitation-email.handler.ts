import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { InvitationRepository } from "../domain/invitation/invitation.repository.js";
import { InvitationSpecifications } from "../domain/invitation/invitation.specification.js";
import { InvitationMailer } from "../domain/ports/clients/invitation-mailer.client.js";
import {
  SendInvitationEmailCommand,
  type SendInvitationEmailResult,
} from "./send-invitation-email.command.js";

// Runs after the issuing transaction committed (see the invitation event
// adapter), so a mail-server outage can neither fail the invite nor be rolled
// back — which is why this handler opens no unit of work of its own.
@CommandHandler(SendInvitationEmailCommand)
export class SendInvitationEmailHandler implements ICommandHandler<SendInvitationEmailCommand> {
  constructor(
    @Inject(InvitationRepository) private readonly invitations: InvitationRepository,
    @Inject(InvitationMailer) private readonly mailer: InvitationMailer,
  ) {}

  public async execute({
    payload,
  }: SendInvitationEmailCommand): Promise<SendInvitationEmailResult> {
    const found = await this.invitations.findOne(
      InvitationSpecifications.withId(payload.invitationId),
    );
    if (found.isErr()) return found;
    const invitation = found.unwrap();
    if (invitation === null) return Ok(undefined);
    await this.mailer.send({
      to: invitation.inviteeEmail,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
    });
    return Ok(undefined);
  }
}
