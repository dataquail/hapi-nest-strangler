import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { CannotPromoteSelf } from "../domain/roles/role.errors.js";
import { RolesRepository } from "../domain/roles/roles.repository.js";
import { RolesRootOps } from "../domain/roles/roles.root-ops.js";
import { RolesSpecifications } from "../domain/roles/roles.specification.js";
import { GrantRoleCommand, type GrantRoleResult } from "./grant-role.command.js";

@CommandHandler(GrantRoleCommand)
export class GrantRoleHandler implements ICommandHandler<GrantRoleCommand> {
  constructor(
    @Inject(RolesRepository) private readonly roles: RolesRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: GrantRoleCommand): Promise<GrantRoleResult> {
    return this.unitOfWork.run<GrantRoleResult>(async () => {
      if (payload.actorUserId === payload.userId) {
        return Err(new CannotPromoteSelf({ userId: payload.userId }));
      }
      const found = await this.roles.findOne(RolesSpecifications.forUser(payload.userId));
      if (found.isErr()) return found;
      const aggregate = found.unwrap() ?? RolesRootOps.empty(payload.userId);
      const granted = RolesRootOps.grant(aggregate, payload.role);
      if (granted.isErr()) return granted;
      const { events, roles } = granted.unwrap();
      const saved = await this.roles.upsertOne(roles);
      if (saved.isErr()) return saved;
      await this.events.dispatch(events);
      return Ok(undefined);
    });
  }
}
