import { Module } from "@nestjs/common";

import { OrganizationModule } from "@/modules/organization/organization.module.js";

import { WalletRepository } from "./domain/wallet/wallet.repository.js";
import { WalletRepositoryLive } from "./infrastructure/repositories/wallet.repository-live.js";
import { OrganizationEventAdapter } from "./interface/events/organization.event-adapter.js";
import { walletCommandHandlers } from "./wallet.command-handlers.js";

// The module states its own imports by importing them (ADR-0032): the
// organization module, whose events the adapter reacts to.
@Module({
  imports: [OrganizationModule],
  providers: [
    ...walletCommandHandlers,
    { provide: WalletRepository, useClass: WalletRepositoryLive },
    OrganizationEventAdapter,
  ],
})
export class WalletModule {}
