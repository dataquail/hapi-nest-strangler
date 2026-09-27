import { Command } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

// The legacy API's compensation: it created this org's wallet and then failed
// to commit the org, so the wallet must go too. Absence is success.
export type DeleteWalletPayload = { readonly organizationId: OrganizationId };

export type DeleteWalletResult = Result<void, PersistenceUnavailable>;

export class DeleteWalletCommand extends Command<DeleteWalletResult> {
  constructor(public readonly payload: DeleteWalletPayload) {
    super();
  }
}
