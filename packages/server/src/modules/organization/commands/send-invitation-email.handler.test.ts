import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { InvitationRootOps } from "../domain/invitation/invitation.root-ops.js";
import { InvitationMailerFake } from "../infrastructure/clients/invitation-mailer.client-fake.js";
import { InvitationRepositoryFake } from "../infrastructure/repositories/invitation.repository-fake.js";
import { SendInvitationEmailCommand } from "./send-invitation-email.command.js";
import { SendInvitationEmailHandler } from "./send-invitation-email.handler.js";

const invitationId = InvitationId.parse("33333333-3333-3333-3333-333333333333");
const organizationId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");

describe("SendInvitationEmailHandler", () => {
  it("mails the invitee with the invitation's token and expiry", async () => {
    const invitations = new InvitationRepositoryFake();
    const expiresAt = new Date("2025-01-08T00:00:00Z");
    await invitations.insertOne(
      InvitationRootOps.issue({
        id: invitationId,
        organizationId,
        inviteeEmail: "a@x.io",
        token: "tok",
        expiresAt,
        now: new Date(),
      }).invitation,
    );
    const mailer = new InvitationMailerFake();
    await new SendInvitationEmailHandler(invitations, mailer).execute(
      new SendInvitationEmailCommand({ invitationId }),
    );
    deepStrictEqual(mailer.sent, [{ to: "a@x.io", token: "tok", expiresAt }]);
  });

  it("does nothing for an unknown invitation", async () => {
    const mailer = new InvitationMailerFake();
    await new SendInvitationEmailHandler(new InvitationRepositoryFake(), mailer).execute(
      new SendInvitationEmailCommand({ invitationId }),
    );
    deepStrictEqual(mailer.sent, []);
  });
});
