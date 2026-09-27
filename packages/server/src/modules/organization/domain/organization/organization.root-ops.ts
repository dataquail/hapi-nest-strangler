import { Err, Ok, type Result } from "oxide.ts";

import type { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationAlreadyDeleted, OrganizationNotDeleted } from "./organization.errors.js";
import {
  OrganizationCreated,
  type OrganizationEvent,
  OrganizationRestored,
  OrganizationSoftDeleted,
} from "./organization.events.js";
import { OrganizationRoot } from "./organization.root.js";
import { OrganizationSpecifications } from "./organization.specification.js";

export type Outcome = {
  readonly organization: OrganizationRoot;
  readonly events: ReadonlyArray<OrganizationEvent>;
};

export type CreateInput = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly now: Date;
};

const create = (input: CreateInput): Outcome => {
  const organization = OrganizationRoot.parse({
    id: input.id,
    name: input.name,
    createdAt: input.now,
    updatedAt: input.now,
    deletedAt: null,
  });
  return {
    organization,
    events: [
      OrganizationCreated.make({ organizationId: organization.id, name: organization.name }),
    ],
  };
};

export type SoftDeleteInput = { readonly now: Date };

const softDelete = (
  organization: OrganizationRoot,
  input: SoftDeleteInput,
): Result<Outcome, OrganizationAlreadyDeleted> => {
  if (OrganizationSpecifications.isDeleted(organization)) {
    return Err(new OrganizationAlreadyDeleted({ organizationId: organization.id }));
  }
  return Ok({
    organization: OrganizationRoot.parse({
      ...organization,
      updatedAt: input.now,
      deletedAt: input.now,
    }),
    events: [OrganizationSoftDeleted.make({ organizationId: organization.id })],
  });
};

export type RestoreInput = { readonly now: Date };

const restore = (
  organization: OrganizationRoot,
  input: RestoreInput,
): Result<Outcome, OrganizationNotDeleted> => {
  if (!OrganizationSpecifications.isDeleted(organization)) {
    return Err(new OrganizationNotDeleted({ organizationId: organization.id }));
  }
  return Ok({
    organization: OrganizationRoot.parse({
      ...organization,
      updatedAt: input.now,
      deletedAt: null,
    }),
    events: [OrganizationRestored.make({ organizationId: organization.id })],
  });
};

export const OrganizationRootOps = { create, softDelete, restore } as const;
