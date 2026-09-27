import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { ApiTokenNotFound } from "../domain/api-token/api-token.errors.js";
import { ApiTokenRepository } from "../domain/api-token/api-token.repository.js";
import { ApiTokenSpecifications } from "../domain/api-token/api-token.specification.js";
import { RevokeApiTokenCommand, type RevokeApiTokenResult } from "./revoke-api-token.command.js";

@CommandHandler(RevokeApiTokenCommand)
export class RevokeApiTokenHandler implements ICommandHandler<RevokeApiTokenCommand> {
  constructor(
    @Inject(ApiTokenRepository) private readonly tokens: ApiTokenRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: RevokeApiTokenCommand): Promise<RevokeApiTokenResult> {
    return this.unitOfWork.run<RevokeApiTokenResult>(async () => {
      const found = await this.tokens.findOne(ApiTokenSpecifications.withId(payload.apiTokenId));
      if (found.isErr()) return found;
      const token = found.unwrap();
      if (token === null || token.userId !== payload.userId) return Err(new ApiTokenNotFound({}));
      return this.tokens.deleteOne(token.id);
    });
  }
}
