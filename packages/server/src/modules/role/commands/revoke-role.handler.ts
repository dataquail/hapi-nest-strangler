import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { RolesRepository } from "../domain/roles/roles.repository.js";
import { RolesRootOps } from "../domain/roles/roles.root-ops.js";
import { RolesSpecifications } from "../domain/roles/roles.specification.js";
import { RevokeRoleCommand, type RevokeRoleResult } from "./revoke-role.command.js";

@CommandHandler(RevokeRoleCommand)
export class RevokeRoleHandler implements ICommandHandler<RevokeRoleCommand> {
  constructor(
    @Inject(RolesRepository) private readonly roles: RolesRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: RevokeRoleCommand): Promise<RevokeRoleResult> {
    return this.unitOfWork.run<RevokeRoleResult>(async () => {
      const found = await this.roles.findOne(RolesSpecifications.forUser(payload.userId));
      if (found.isErr()) return found;
      const aggregate = found.unwrap() ?? RolesRootOps.empty(payload.userId);
      const revoked = RolesRootOps.revoke(aggregate, payload.role);
      if (revoked.isErr()) return revoked;
      const { events, roles } = revoked.unwrap();
      const saved = await this.roles.upsertOne(roles);
      if (saved.isErr()) return saved;
      await this.events.dispatch(events);
      return Ok(undefined);
    });
  }
}
