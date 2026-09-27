import type { Plugin, Server } from "@hapi/hapi";
import * as ioc from "electrolyte";

import { domainEvents } from "./src/constants/domain-events";
import * as logger from "./src/lib/logger";

// Server events are how a service announces what happened after its
// transaction committed; the handlers here reach straight into other services.
// A failing handler is logged and never fails the request that emitted it.
const plugin: Plugin<Record<string, never>> = {
  name: "domainEventHandlerPlugin",
  register: async (server: Server) => {
    const emailService = await ioc.create("email/email-service");
    const organizationService = await ioc.create("organization/organization-service");

    const sendInvitation = async ({ invitationId }: { invitationId: string }) => {
      try {
        const invitation = await organizationService.findInvitationById(invitationId);
        if (!invitation) return;
        await emailService.sendInvitation({
          to: invitation.invitee_email,
          token: invitation.token,
          expiresAt: invitation.expires_at,
        });
      } catch (error) {
        logger.error(`invitation email failed for ${invitationId}`, error);
      }
    };

    server.event(domainEvents.INVITATION_ISSUED);
    server.events.on(domainEvents.INVITATION_ISSUED, (payload: { invitationId: string }) => {
      void sendInvitation(payload);
    });

    server.event(domainEvents.INVITATION_REISSUED);
    server.events.on(domainEvents.INVITATION_REISSUED, (payload: { invitationId: string }) => {
      void sendInvitation(payload);
    });

    server.event(domainEvents.ORGANIZATION_CREATED);
  },
};

export = plugin;
