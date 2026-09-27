import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { InvitationAcceptance } from "../domain/domain-services/invitation-acceptance.domain-service.js";
import { InvitationTokenNotFound } from "../domain/invitation/invitation.errors.js";
import { InvitationRepository } from "../domain/invitation/invitation.repository.js";
import { InvitationSpecifications } from "../domain/invitation/invitation.specification.js";
import { MembershipRepository } from "../domain/membership/membership.repository.js";
import { SuperAdminCannotOwnOrganization } from "../domain/organization/organization.errors.js";
import { PlatformRoles } from "../domain/ports/acl/platform-roles.acl.js";
import {
  AcceptInvitationCommand,
  type AcceptInvitationResult,
} from "./accept-invitation.command.js";

@CommandHandler(AcceptInvitationCommand)
export class AcceptInvitationHandler implements ICommandHandler<AcceptInvitationCommand> {
  constructor(
    @Inject(InvitationRepository) private readonly invitations: InvitationRepository,
    @Inject(MembershipRepository) private readonly memberships: MembershipRepository,
    @Inject(PlatformRoles) private readonly roles: PlatformRoles,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: AcceptInvitationCommand): Promise<AcceptInvitationResult> {
    return this.unitOfWork.run<AcceptInvitationResult>(async () => {
      const superAdmin = await this.roles.isSuperAdmin(payload.userId);
      if (superAdmin.isErr()) return superAdmin;
      if (superAdmin.unwrap())
        return Err(new SuperAdminCannotOwnOrganization({ userId: payload.userId }));

      const found = await this.invitations.findOne(
        InvitationSpecifications.withToken(payload.token),
      );
      if (found.isErr()) return found;
      const invitation = found.unwrap();
      if (invitation === null) return Err(new InvitationTokenNotFound({}));

      const accepted = InvitationAcceptance.accept(invitation, {
        userId: payload.userId,
        now: new Date(),
      });
      if (accepted.isErr()) return accepted;
      const outcome = accepted.unwrap();

      const updated = await this.invitations.updateOne(outcome.invitation);
      if (updated.isErr()) {
        const error = updated.unwrapErr();
        if (error._tag === "InvitationNotFound")
          throw new Error(`Invitation ${invitation.id} vanished mid-accept`);
        return Err(error);
      }
      const inserted = await this.memberships.insertOne(outcome.membership);
      if (inserted.isErr()) return inserted;
      await this.events.dispatch(outcome.events);
      return Ok(invitation.organizationId);
    });
  }
}
