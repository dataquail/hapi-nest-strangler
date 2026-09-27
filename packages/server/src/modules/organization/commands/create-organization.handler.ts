import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { MembershipRepository } from "../domain/membership/membership.repository.js";
import { MembershipRootOps } from "../domain/membership/membership.root-ops.js";
import { SuperAdminCannotOwnOrganization } from "../domain/organization/organization.errors.js";
import { OrganizationRepository } from "../domain/organization/organization.repository.js";
import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { OrganizationRolesRepository } from "../domain/organization-roles/organization-roles.repository.js";
import { OrganizationRolesRootOps } from "../domain/organization-roles/organization-roles.root-ops.js";
import { PlatformRoles } from "../domain/ports/acl/platform-roles.acl.js";
import {
  CreateOrganizationCommand,
  type CreateOrganizationResult,
} from "./create-organization.command.js";

@CommandHandler(CreateOrganizationCommand)
export class CreateOrganizationHandler implements ICommandHandler<CreateOrganizationCommand> {
  constructor(
    @Inject(OrganizationRepository) private readonly organizations: OrganizationRepository,
    @Inject(MembershipRepository) private readonly memberships: MembershipRepository,
    @Inject(OrganizationRolesRepository)
    private readonly organizationRoles: OrganizationRolesRepository,
    @Inject(PlatformRoles) private readonly roles: PlatformRoles,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: CreateOrganizationCommand): Promise<CreateOrganizationResult> {
    return this.unitOfWork.run<CreateOrganizationResult>(async () => {
      const superAdmin = await this.roles.isSuperAdmin(payload.actorUserId);
      if (superAdmin.isErr()) return superAdmin;
      if (superAdmin.unwrap())
        return Err(new SuperAdminCannotOwnOrganization({ userId: payload.actorUserId }));

      const now = new Date();
      const id = OrganizationId.parse(crypto.randomUUID());
      const { events: orgEvents, organization } = OrganizationRootOps.create({
        id,
        name: payload.name,
        now,
      });
      const { events: memberEvents, membership } = MembershipRootOps.create({
        userId: payload.actorUserId,
        organizationId: id,
        now,
      });
      const grant = OrganizationRolesRootOps.grantRole(
        OrganizationRolesRootOps.empty(payload.actorUserId, id),
        "admin",
        payload.actorUserId,
      ).unwrap();

      const insertedOrg = await this.organizations.insertOne(organization);
      if (insertedOrg.isErr()) return insertedOrg;
      const insertedMember = await this.memberships.insertOne(membership);
      if (insertedMember.isErr()) return insertedMember;
      const savedRoles = await this.organizationRoles.upsertOne(grant.organizationRoles);
      if (savedRoles.isErr()) return savedRoles;
      await this.events.dispatch([...orgEvents, ...memberEvents, ...grant.events]);
      return Ok(id);
    });
  }
}
