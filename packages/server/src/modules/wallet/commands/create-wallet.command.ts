import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

// Dispatched by the internal create endpoint when the legacy API creates an
// organization: the only way to get a wallet is for an org to exist there.
export type CreateWalletPayload = { readonly organizationId: OrganizationId };

export type CreateWalletResult = Result<void, PersistenceUnavailable>;

export class CreateWalletCommand extends Command<CreateWalletResult> {
  constructor(public readonly payload: CreateWalletPayload) {
    super();
  }
}
