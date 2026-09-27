import { Err, Ok, type Result } from "oxide.ts";

import { WalletAlreadyExistsForOrganization } from "@/modules/wallet/domain/wallet/wallet.errors.js";
import type { WalletId } from "@/modules/wallet/domain/wallet/wallet.id.js";
import { WalletRepository } from "@/modules/wallet/domain/wallet/wallet.repository.js";
import type { WalletRoot } from "@/modules/wallet/domain/wallet/wallet.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

export class WalletRepositoryFake extends WalletRepository {
  private readonly store = new Map<WalletId, WalletRoot>();

  public insertOne(
    wallet: WalletRoot,
  ): Promise<Result<void, WalletAlreadyExistsForOrganization | PersistenceUnavailable>> {
    const clash = [...this.store.values()].some(
      (stored) => stored.organizationId === wallet.organizationId,
    );
    if (clash) {
      return Promise.resolve(
        Err(new WalletAlreadyExistsForOrganization({ organizationId: wallet.organizationId })),
      );
    }
    this.store.set(wallet.id, wallet);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<WalletRoot>,
  ): Promise<Result<WalletRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }
}
