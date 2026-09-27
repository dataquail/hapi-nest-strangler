import { Inject, Injectable, Logger } from "@nestjs/common";
import { render } from "@react-email/render";
import { createElement } from "react";

import { EnvVars } from "@/common/env-vars.js";
import {
  InvitationMailer,
  type SendInvitationInput,
} from "@/modules/organization/domain/ports/clients/invitation-mailer.client.js";
import { Mailer } from "@/platform/notifications/mailer.js";

import { InvitationEmail } from "./invitation.email.js";

const SUBJECT = "You're invited to join an organization";

@Injectable()
export class InvitationMailerLive extends InvitationMailer {
  private readonly logger = new Logger(InvitationMailerLive.name);

  constructor(
    @Inject(Mailer) private readonly mailer: Mailer,
    @Inject(EnvVars) private readonly env: EnvVars,
  ) {
    super();
  }

  public async send({ expiresAt, to, token }: SendInvitationInput): Promise<void> {
    const acceptUrl = `${this.env.APP_URL}/invitations/${token}`;
    const expiresLabel = expiresAt.toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
    const element = createElement(InvitationEmail, { acceptUrl, expiresLabel });
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const delivered = await this.mailer.send({ to, subject: SUBJECT, html, text });
    if (delivered.isErr()) {
      this.logger.error(
        `Invitation email delivery failed to=${to}: ${delivered.unwrapErr().message}`,
      );
    }
  }
}
