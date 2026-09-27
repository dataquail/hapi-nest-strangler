import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { OrganizationRolesRepository } from "../domain/organization-roles/organization-roles.repository.js";
import { OrganizationRolesRootOps } from "../domain/organization-roles/organization-roles.root-ops.js";
import { OrganizationRolesSpecifications } from "../domain/organization-roles/organization-roles.specification.js";
import {
  RevokeOrganizationRoleCommand,
  type RevokeOrganizationRoleResult,
} from "./revoke-organization-role.command.js";

@CommandHandler(RevokeOrganizationRoleCommand)
export class RevokeOrganizationRoleHandler implements ICommandHandler<RevokeOrganizationRoleCommand> {
  constructor(
    @Inject(OrganizationRolesRepository)
    private readonly organizationRoles: OrganizationRolesRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({
    payload,
  }: RevokeOrganizationRoleCommand): Promise<RevokeOrganizationRoleResult> {
    return this.unitOfWork.run<RevokeOrganizationRoleResult>(async () => {
      const found = await this.organizationRoles.findOne(
        Spec.and(
          OrganizationRolesSpecifications.forUser(payload.userId),
          OrganizationRolesSpecifications.forOrganization(payload.organizationId),
        ),
      );
      if (found.isErr()) return found;
      const aggregate =
        found.unwrap() ?? OrganizationRolesRootOps.empty(payload.userId, payload.organizationId);
      const revoked = OrganizationRolesRootOps.revokeRole(aggregate, payload.role);
      if (revoked.isErr()) return revoked;
      const saved = await this.organizationRoles.upsertOne(revoked.unwrap().organizationRoles);
      if (saved.isErr()) return saved;
      await this.events.dispatch(revoked.unwrap().events);
      return Ok(undefined);
    });
  }
}
