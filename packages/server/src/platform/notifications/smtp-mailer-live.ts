import { Inject, Injectable } from "@nestjs/common";
import nodemailer, { type Transporter } from "nodemailer";
import { Err, Ok, type Result } from "oxide.ts";

import { EnvVars } from "@/common/env-vars.js";

import { MailDeliveryError } from "./mail-errors.js";
import { Mailer, type MailMessage } from "./mailer.js";

@Injectable()
export class SmtpMailerLive extends Mailer {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(@Inject(EnvVars) env: EnvVars) {
    super();
    this.from = env.MAIL_FROM;
    this.transporter = nodemailer.createTransport({
      host: env.MAIL_SMTP_HOST,
      port: env.MAIL_SMTP_PORT,
      secure: env.MAIL_SMTP_SECURE,
      ...(env.MAIL_SMTP_USER === ""
        ? {}
        : { auth: { user: env.MAIL_SMTP_USER, pass: env.MAIL_SMTP_PASSWORD } }),
    });
  }

  public async send(message: MailMessage): Promise<Result<void, MailDeliveryError>> {
    try {
      await this.transporter.sendMail({
        from: message.from ?? this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return Ok(undefined);
    } catch (cause) {
      return Err(new MailDeliveryError({ message: `SMTP delivery failed: ${String(cause)}` }));
    }
  }
}
