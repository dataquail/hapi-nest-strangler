import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { CannotPromoteSelfInOrganization } from "../domain/organization-roles/organization-role.errors.js";
import { OrganizationRolesRepository } from "../domain/organization-roles/organization-roles.repository.js";
import { OrganizationRolesRootOps } from "../domain/organization-roles/organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "../domain/organization-roles/organization-roles.specification.js";
import {
  GrantOrganizationRoleCommand,
  type GrantOrganizationRoleResult,
} from "./grant-organization-role.command.js";

@CommandHandler(GrantOrganizationRoleCommand)
export class GrantOrganizationRoleHandler implements ICommandHandler<GrantOrganizationRoleCommand> {
  constructor(
    @Inject(OrganizationRolesRepository)
    private readonly organizationRoles: OrganizationRolesRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: GrantOrganizationRoleCommand): Promise<GrantOrganizationRoleResult> {
    return this.unitOfWork.run<GrantOrganizationRoleResult>(async () => {
      if (payload.actorUserId === payload.userId) {
        return Err(
          new CannotPromoteSelfInOrganization({
            userId: payload.userId,
            organizationId: payload.organizationId,
          }),
        );
      }
      const found = await this.organizationRoles.findOne(
        Spec.and(
          OrganizationRolesSpecifications.forUser(payload.userId),
          OrganizationRolesSpecifications.forOrganization(payload.organizationId),
        ),
      );
      if (found.isErr()) return found;
      const aggregate =
        found.unwrap() ?? OrganizationRolesRootOps.empty(payload.userId, payload.organizationId);
      const granted = OrganizationRolesRootOps.grantRole(
        aggregate,
        payload.role,
        payload.actorUserId,
      );
      if (granted.isErr()) return granted;
      const saved = await this.organizationRoles.upsertOne(granted.unwrap().organizationRoles);
      if (saved.isErr()) return saved;
      await this.events.dispatch(granted.unwrap().events);
      return Ok(undefined);
    });
  }
}
