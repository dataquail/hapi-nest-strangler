import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { WalletRepository } from "../domain/wallet/wallet.repository.js";
import { DeleteWalletCommand, type DeleteWalletResult } from "./delete-wallet.command.js";

// Idempotent: a retried compensation for a wallet already gone is a no-op.
@CommandHandler(DeleteWalletCommand)
export class DeleteWalletHandler implements ICommandHandler<DeleteWalletCommand> {
  constructor(
    @Inject(WalletRepository) private readonly wallets: WalletRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: DeleteWalletCommand): Promise<DeleteWalletResult> {
    return this.unitOfWork.run<DeleteWalletResult>(async () => {
      const deleted = await this.wallets.deleteOne(payload.organizationId);
      if (deleted.isErr()) {
        const error = deleted.unwrapErr();
        return error._tag === "WalletNotFound" ? Ok(undefined) : Err(error);
      }
      return Ok(undefined);
    });
  }
}
