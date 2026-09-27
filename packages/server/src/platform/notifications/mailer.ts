import type { Result } from "oxide.ts";

import type { MailDeliveryError } from "./mail-errors.js";

export type MailMessage = {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly from?: string;
};

export abstract class Mailer {
  public abstract send(message: MailMessage): Promise<Result<void, MailDeliveryError>>;
}
