import {
  InvitationMailer,
  type SendInvitationInput,
} from "@/modules/organization/domain/ports/clients/invitation-mailer.client.js";

export class InvitationMailerFake extends InvitationMailer {
  public readonly sent: Array<SendInvitationInput> = [];

  public send(input: SendInvitationInput): Promise<void> {
    this.sent.push(input);
    return Promise.resolve();
  }
}
