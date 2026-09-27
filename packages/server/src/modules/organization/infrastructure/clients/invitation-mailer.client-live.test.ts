import { deepStrictEqual } from "node:assert";

import { Err, Ok, type Result } from "oxide.ts";
import { describe, it } from "vitest";

import type { EnvVars } from "@/common/env-vars.js";
import { MailDeliveryError } from "@/platform/notifications/mail-errors.js";
import type { Mailer, MailMessage } from "@/platform/notifications/mailer.js";

import { InvitationMailerLive } from "./invitation-mailer.client-live.js";

const env = { APP_URL: "http://localhost:3000" } as EnvVars;

const recordingMailer = (outcome: Result<void, MailDeliveryError>) => {
  const sent: Array<MailMessage> = [];
  const mailer: Mailer = {
    send: (message) => {
      sent.push(message);
      return Promise.resolve(outcome);
    },
  };
  return { mailer, sent };
};

describe("InvitationMailerLive", () => {
  it("renders the accept link into html and text and sends through the Mailer port", async () => {
    const { mailer, sent } = recordingMailer(Ok(undefined));
    await new InvitationMailerLive(mailer, env).send({
      to: "a@x.io",
      token: "tok",
      expiresAt: new Date("2025-01-08T00:00:00Z"),
    });
    deepStrictEqual(sent.length, 1);
    deepStrictEqual(sent[0]?.to, "a@x.io");
    deepStrictEqual(sent[0]?.html.includes("http://localhost:3000/invitations/tok"), true);
    deepStrictEqual(sent[0]?.text.includes("http://localhost:3000/invitations/tok"), true);
  });

  it("swallows a delivery failure: the invitation stands whether or not the email lands", async () => {
    const { mailer } = recordingMailer(Err(new MailDeliveryError({ message: "smtp down" })));
    await new InvitationMailerLive(mailer, env).send({
      to: "a@x.io",
      token: "tok",
      expiresAt: new Date(),
    });
  });
});
