import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { ApiTokenRepository } from "../domain/api-token/api-token.repository.js";
import { ApiTokenRootOps } from "../domain/api-token/api-token.root-ops.js";
import { ApiTokenSpecifications } from "../domain/api-token/api-token.specification.js";
import { TouchApiTokenCommand, type TouchApiTokenResult } from "./touch-api-token.command.js";

@CommandHandler(TouchApiTokenCommand)
export class TouchApiTokenHandler implements ICommandHandler<TouchApiTokenCommand> {
  constructor(
    @Inject(ApiTokenRepository) private readonly tokens: ApiTokenRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: TouchApiTokenCommand): Promise<TouchApiTokenResult> {
    return this.unitOfWork.run<TouchApiTokenResult>(async () => {
      const found = await this.tokens.findOne(ApiTokenSpecifications.withId(payload.apiTokenId));
      const token = found.isOk() ? found.unwrap() : null;
      if (token?.revokedAt !== null) return Ok(undefined);
      const now = new Date();
      const elapsedSeconds = (now.getTime() - token.lastUsedAt.getTime()) / 1000;
      if (elapsedSeconds < payload.thresholdSeconds) return Ok(undefined);
      await this.tokens.updateOne(ApiTokenRootOps.touch({ token, now }));
      return Ok(undefined);
    });
  }
}
