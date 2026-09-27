import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { Inject, Injectable } from "@nestjs/common";
import { Err, Ok, type Result } from "oxide.ts";

import { EnvVars } from "@/common/env-vars.js";

import { MailDeliveryError } from "./mail-errors.js";
import { Mailer, type MailMessage } from "./mailer.js";

@Injectable()
export class SesMailerLive extends Mailer {
  private readonly client = new SESv2Client({});
  private readonly from: string;

  constructor(@Inject(EnvVars) env: EnvVars) {
    super();
    this.from = env.MAIL_FROM;
  }

  public async send(message: MailMessage): Promise<Result<void, MailDeliveryError>> {
    try {
      await this.client.send(
        new SendEmailCommand({
          FromEmailAddress: message.from ?? this.from,
          Destination: { ToAddresses: [message.to] },
          Content: {
            Simple: {
              Subject: { Data: message.subject },
              Body: { Html: { Data: message.html }, Text: { Data: message.text } },
            },
          },
        }),
      );
      return Ok(undefined);
    } catch (cause) {
      return Err(new MailDeliveryError({ message: `SES delivery failed: ${String(cause)}` }));
    }
  }
}
