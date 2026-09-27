export type SendInvitationInput = {
  readonly to: string;
  readonly token: string;
  readonly expiresAt: Date;
};

// Delivery failures are the adapter's to log: an invitation is issued whether
// or not the email lands, so the port cannot fail.
export abstract class InvitationMailer {
  public abstract send(input: SendInvitationInput): Promise<void>;
}
