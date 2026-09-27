import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { WalletId } from "../domain/wallet/wallet.id.js";
import { WalletRepository } from "../domain/wallet/wallet.repository.js";
import { WalletRootOps } from "../domain/wallet/wallet.root-ops.js";
import { CreateWalletCommand, type CreateWalletResult } from "./create-wallet.command.js";

// Idempotent: the legacy API may retry, so a duplicate for an org that already
// has a wallet is a no-op and WalletCreated fires only on a fresh insert.
@CommandHandler(CreateWalletCommand)
export class CreateWalletHandler implements ICommandHandler<CreateWalletCommand> {
  constructor(
    @Inject(WalletRepository) private readonly wallets: WalletRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: CreateWalletCommand): Promise<CreateWalletResult> {
    return this.unitOfWork.run<CreateWalletResult>(async () => {
      const { events, wallet } = WalletRootOps.create({
        id: WalletId.parse(crypto.randomUUID()),
        organizationId: payload.organizationId,
        now: new Date(),
      });
      const inserted = await this.wallets.insertOne(wallet);
      if (inserted.isErr()) {
        const error = inserted.unwrapErr();
        return error._tag === "WalletAlreadyExistsForOrganization" ? Ok(undefined) : Err(error);
      }
      await this.events.dispatch(events);
      return Ok(undefined);
    });
  }
}
