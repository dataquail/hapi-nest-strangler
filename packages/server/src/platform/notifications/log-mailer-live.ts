import { Injectable, Logger } from "@nestjs/common";
import { Ok, type Result } from "oxide.ts";

import type { MailDeliveryError } from "./mail-errors.js";
import { Mailer, type MailMessage } from "./mailer.js";

@Injectable()
export class LogMailerLive extends Mailer {
  private readonly logger = new Logger("Mailer");

  public send(message: MailMessage): Promise<Result<void, MailDeliveryError>> {
    this.logger.log(`mail to=${message.to} subject=${JSON.stringify(message.subject)}`);
    return Promise.resolve(Ok(undefined));
  }
}
