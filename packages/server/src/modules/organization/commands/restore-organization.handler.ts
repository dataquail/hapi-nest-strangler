import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { OrganizationNotFound } from "../domain/organization/organization.errors.js";
import { OrganizationRepository } from "../domain/organization/organization.repository.js";
import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { OrganizationSpecifications } from "../domain/organization/organization.specification.js";
import {
  RestoreOrganizationCommand,
  type RestoreOrganizationResult,
} from "./restore-organization.command.js";

@CommandHandler(RestoreOrganizationCommand)
export class RestoreOrganizationHandler implements ICommandHandler<RestoreOrganizationCommand> {
  constructor(
    @Inject(OrganizationRepository) private readonly organizations: OrganizationRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: RestoreOrganizationCommand): Promise<RestoreOrganizationResult> {
    return this.unitOfWork.run<RestoreOrganizationResult>(async () => {
      const found = await this.organizations.findOne(
        OrganizationSpecifications.withId(payload.organizationId),
      );
      if (found.isErr()) return found;
      const organization = found.unwrap();
      if (organization === null)
        return Err(new OrganizationNotFound({ organizationId: payload.organizationId }));
      const restored = OrganizationRootOps.restore(organization, { now: new Date() });
      if (restored.isErr()) return restored;
      const updated = await this.organizations.updateOne(restored.unwrap().organization);
      if (updated.isErr()) return updated;
      await this.events.dispatch(restored.unwrap().events);
      return Ok(undefined);
    });
  }
}
