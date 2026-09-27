import { randomBytes } from "node:crypto";

import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";

import { InvitationRepository } from "../domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "../domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "../domain/invitation/invitation.specification.js";
import { InviteUserCommand, type InviteUserResult } from "./invite-user.command.js";

@CommandHandler(InviteUserCommand)
export class InviteUserHandler implements ICommandHandler<InviteUserCommand> {
  constructor(
    @Inject(InvitationRepository) private readonly invitations: InvitationRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  // An open invitation for the same address is reissued rather than duplicated.
  public execute({ payload }: InviteUserCommand): Promise<InviteUserResult> {
    return this.unitOfWork.run<InviteUserResult>(async () => {
      const now = new Date();
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + payload.ttlSeconds * 1000);

      const found = await this.invitations.findOne(
        Spec.and(
          InvitationSpecifications.forOrganization(payload.organizationId),
          InvitationSpecifications.withInviteeEmail(payload.inviteeEmail),
          InvitationSpecifications.isOpen,
        ),
      );
      if (found.isErr()) return found;
      const openInvite = found.unwrap();
      if (openInvite !== null) {
        const reissued = InvitationRootOps.reissue(openInvite, { token, expiresAt, now });
        if (reissued.isErr()) throw new Error(`Open invitation ${openInvite.id} refused a reissue`);
        const updated = await this.invitations.updateOne(reissued.unwrap().invitation);
        if (updated.isErr()) {
          const error = updated.unwrapErr();
          if (error._tag === "InvitationNotFound")
            throw new Error(`Invitation ${openInvite.id} vanished mid-reissue`);
          return updated as InviteUserResult;
        }
        await this.events.dispatch(reissued.unwrap().events);
        return Ok(openInvite.id);
      }

      const id = InvitationId.parse(crypto.randomUUID());
      const { events, invitation } = InvitationRootOps.issue({
        id,
        organizationId: payload.organizationId,
        inviteeEmail: payload.inviteeEmail,
        token,
        expiresAt,
        now,
      });
      const inserted = await this.invitations.insertOne(invitation);
      if (inserted.isErr()) return inserted;
      await this.events.dispatch(events);
      return Ok(id);
    });
  }
}
