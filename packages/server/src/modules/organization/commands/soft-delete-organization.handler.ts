import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { OrganizationNotFound } from "../domain/organization/organization.errors.js";
import { OrganizationRepository } from "../domain/organization/organization.repository.js";
import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { OrganizationSpecifications } from "../domain/organization/organization.specification.js";
import {
  SoftDeleteOrganizationCommand,
  type SoftDeleteOrganizationResult,
} from "./soft-delete-organization.command.js";

@CommandHandler(SoftDeleteOrganizationCommand)
export class SoftDeleteOrganizationHandler implements ICommandHandler<SoftDeleteOrganizationCommand> {
  constructor(
    @Inject(OrganizationRepository) private readonly organizations: OrganizationRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({
    payload,
  }: SoftDeleteOrganizationCommand): Promise<SoftDeleteOrganizationResult> {
    return this.unitOfWork.run<SoftDeleteOrganizationResult>(async () => {
      const found = await this.organizations.findOne(
        Spec.and(
          OrganizationSpecifications.withId(payload.organizationId),
          OrganizationSpecifications.notDeleted,
        ),
      );
      if (found.isErr()) return found;
      const organization = found.unwrap();
      if (organization === null)
        return Err(new OrganizationNotFound({ organizationId: payload.organizationId }));
      const deleted = OrganizationRootOps.softDelete(organization, { now: new Date() });
      if (deleted.isErr()) return deleted;
      const updated = await this.organizations.updateOne(deleted.unwrap().organization);
      if (updated.isErr()) return updated;
      await this.events.dispatch(deleted.unwrap().events);
      return Ok(undefined);
    });
  }
}
