import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { WalletId } from "./wallet.id.js";

export class WalletAlreadyExistsForOrganization extends TaggedError(
  "WalletAlreadyExistsForOrganization",
)<{
  readonly organizationId: OrganizationId;
}> {}

export class WalletNotFound extends TaggedError("WalletNotFound")<{
  readonly organizationId: OrganizationId;
}> {}

export class WalletInsufficientFunds extends TaggedError("WalletInsufficientFunds")<{
  readonly walletId: WalletId;
  readonly balance: number;
  readonly attemptedDebit: number;
}> {}

export class WalletInvalidAmount extends TaggedError("WalletInvalidAmount")<{
  readonly walletId: WalletId;
  readonly amount: number;
}> {}
