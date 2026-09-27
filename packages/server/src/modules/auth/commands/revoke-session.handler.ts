import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { SessionRepository } from "../domain/session/session.repository.js";
import { RevokeSessionCommand, type RevokeSessionResult } from "./revoke-session.command.js";

@CommandHandler(RevokeSessionCommand)
export class RevokeSessionHandler implements ICommandHandler<RevokeSessionCommand> {
  constructor(
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: RevokeSessionCommand): Promise<RevokeSessionResult> {
    return this.unitOfWork.run<RevokeSessionResult>(async () => {
      await this.sessions.deleteOne(payload.sessionId);
      return Ok(undefined);
    });
  }
}
