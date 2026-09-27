import { Ok, type Result } from "oxide.ts";

import type { MailDeliveryError } from "@/platform/notifications/mail-errors.js";
import { Mailer, type MailMessage } from "@/platform/notifications/mailer.js";

/** Records every message handed to the platform transport so a test can assert against it. */
export class MailerFake extends Mailer {
  public readonly sent: Array<MailMessage> = [];

  public send(message: MailMessage): Promise<Result<void, MailDeliveryError>> {
    this.sent.push(message);
    return Promise.resolve(Ok(undefined));
  }
}
