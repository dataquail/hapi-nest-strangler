import { Module } from "@nestjs/common";

import { WalletRepository } from "./domain/wallet/wallet.repository.js";
import { WalletRepositoryLive } from "./infrastructure/repositories/wallet.repository-live.js";
import { walletEndpoints } from "./interface/http/index.js";
import { walletCommandHandlers } from "./wallet.command-handlers.js";
import { walletQueryHandlers } from "./wallet.query-handlers.js";

@Module({
  controllers: [...walletEndpoints],
  providers: [
    ...walletCommandHandlers,
    ...walletQueryHandlers,
    { provide: WalletRepository, useClass: WalletRepositoryLive },
  ],
})
export class WalletModule {}
