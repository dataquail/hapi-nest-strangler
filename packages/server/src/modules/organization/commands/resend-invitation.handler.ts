import { randomBytes } from "node:crypto";

import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { InvitationNotFound } from "../domain/invitation/invitation.errors.js";
import { InvitationRepository } from "../domain/invitation/invitation.repository.js";
import { InvitationRootOps } from "../domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "../domain/invitation/invitation.specification.js";
import {
  ResendInvitationCommand,
  type ResendInvitationResult,
} from "./resend-invitation.command.js";

@CommandHandler(ResendInvitationCommand)
export class ResendInvitationHandler implements ICommandHandler<ResendInvitationCommand> {
  constructor(
    @Inject(InvitationRepository) private readonly invitations: InvitationRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: ResendInvitationCommand): Promise<ResendInvitationResult> {
    return this.unitOfWork.run<ResendInvitationResult>(async () => {
      const now = new Date();
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + payload.ttlSeconds * 1000);
      const found = await this.invitations.findOne(
        InvitationSpecifications.withId(payload.invitationId),
      );
      if (found.isErr()) return found;
      const invitation = found.unwrap();
      if (invitation === null)
        return Err(new InvitationNotFound({ invitationId: payload.invitationId }));
      const reissued = InvitationRootOps.reissue(invitation, { token, expiresAt, now });
      if (reissued.isErr()) return reissued;
      const updated = await this.invitations.updateOne(reissued.unwrap().invitation);
      if (updated.isErr()) return updated;
      await this.events.dispatch(reissued.unwrap().events);
      return Ok(undefined);
    });
  }
}
