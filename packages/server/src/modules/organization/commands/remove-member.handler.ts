import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { MembershipNotFound } from "../domain/membership/membership.errors.js";
import { MembershipRepository } from "../domain/membership/membership.repository.js";
import { MembershipRootOps } from "../domain/membership/membership.root-ops.js";
import { MembershipSpecifications } from "../domain/membership/membership.specification.js";
import { RemoveMemberCommand, type RemoveMemberResult } from "./remove-member.command.js";

@CommandHandler(RemoveMemberCommand)
export class RemoveMemberHandler implements ICommandHandler<RemoveMemberCommand> {
  constructor(
    @Inject(MembershipRepository) private readonly memberships: MembershipRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: RemoveMemberCommand): Promise<RemoveMemberResult> {
    return this.unitOfWork.run<RemoveMemberResult>(async () => {
      const found = await this.memberships.findOne(
        Spec.and(
          MembershipSpecifications.forUser(payload.targetUserId),
          MembershipSpecifications.forOrganization(payload.organizationId),
        ),
      );
      if (found.isErr()) return found;
      const membership = found.unwrap();
      if (membership === null) {
        return Err(
          new MembershipNotFound({
            userId: payload.targetUserId,
            organizationId: payload.organizationId,
          }),
        );
      }
      const { events } = MembershipRootOps.revoke(membership);
      const deleted = await this.memberships.deleteOne(
        payload.targetUserId,
        payload.organizationId,
      );
      if (deleted.isErr()) return deleted;
      await this.events.dispatch(events);
      return Ok(undefined);
    });
  }
}
