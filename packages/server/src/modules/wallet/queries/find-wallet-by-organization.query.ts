import { Query } from "@nestjs/cqrs";
import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { WalletId } from "../domain/wallet/wallet.id.js";

export type WalletView = {
  readonly id: WalletId;
  readonly organizationId: OrganizationId;
  readonly balance: number;
};

export type FindWalletByOrganizationPayload = { readonly organizationId: OrganizationId };

// Absence is null; the endpoint turns it into the contract's 404.
export type FindWalletByOrganizationResult = Result<WalletView | null, PersistenceUnavailable>;

export class FindWalletByOrganizationQuery extends Query<FindWalletByOrganizationResult> {
  constructor(public readonly payload: FindWalletByOrganizationPayload) {
    super();
  }
}
