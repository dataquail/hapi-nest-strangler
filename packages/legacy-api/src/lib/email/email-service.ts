import nodemailer, { type Transporter } from "nodemailer";

import config = require("../../../config");
import * as logger from "../logger";
import { renderTemplate } from "../render-template";

type Mail = { to: string; subject: string; html: string; text: string };

type MailConfig = {
  transport: "log" | "smtp";
  from: string;
  smtp: { host: string; port: number; secure: boolean; user: string; password: string };
};

const INVITATION_SUBJECT = "You're invited to join an organization";

// One transport picked at boot from config. Under "log" nothing leaves the
// process and every mail is kept on `sent`, which is what the tests read.
class EmailService {
  public sent: Mail[] = [];
  private transporter: Transporter | null = null;

  get settings(): MailConfig {
    return config("/mail");
  }

  async send(mail: Mail): Promise<void> {
    if (this.settings.transport === "log") {
      this.sent.push(mail);
      logger.info(`mail to=${mail.to} subject=${JSON.stringify(mail.subject)}`);
      return;
    }
    try {
      await this.transport().sendMail({ from: this.settings.from, ...mail });
    } catch (error) {
      logger.error(`mail delivery failed to=${mail.to}`, error);
    }
  }

  async sendInvitation(input: { to: string; token: string; expiresAt: Date }): Promise<void> {
    const acceptUrl = `${config("/appUrl")}/invitations/${input.token}`;
    const expiresLabel = new Date(input.expiresAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    });
    const html = renderTemplate("invitation-email", { acceptUrl, expiresLabel });
    const text = `You've been invited to join an organization. Accept it at ${acceptUrl} before ${expiresLabel}.`;
    await this.send({ to: input.to, subject: INVITATION_SUBJECT, html, text });
  }

  private transport(): Transporter {
    if (this.transporter) return this.transporter;
    const { smtp } = this.settings;
    this.transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      ...(smtp.user === "" ? {} : { auth: { user: smtp.user, pass: smtp.password } }),
    });
    return this.transporter;
  }
}

EmailService["@singleton"] = true;

export = EmailService;
