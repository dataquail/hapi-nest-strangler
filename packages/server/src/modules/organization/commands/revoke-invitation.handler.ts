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
  RevokeInvitationCommand,
  type RevokeInvitationResult,
} from "./revoke-invitation.command.js";

@CommandHandler(RevokeInvitationCommand)
export class RevokeInvitationHandler implements ICommandHandler<RevokeInvitationCommand> {
  constructor(
    @Inject(InvitationRepository) private readonly invitations: InvitationRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: RevokeInvitationCommand): Promise<RevokeInvitationResult> {
    return this.unitOfWork.run<RevokeInvitationResult>(async () => {
      const found = await this.invitations.findOne(
        InvitationSpecifications.withId(payload.invitationId),
      );
      if (found.isErr()) return found;
      const invitation = found.unwrap();
      if (invitation === null)
        return Err(new InvitationNotFound({ invitationId: payload.invitationId }));
      const revoked = InvitationRootOps.revoke(invitation, { now: new Date() });
      if (revoked.isErr()) return revoked;
      const updated = await this.invitations.updateOne(revoked.unwrap().invitation);
      if (updated.isErr()) return updated;
      await this.events.dispatch(revoked.unwrap().events);
      return Ok(undefined);
    });
  }
}
