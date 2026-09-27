import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { SessionRepository } from "../domain/session/session.repository.js";
import { SessionRootOps } from "../domain/session/session.root-ops.js";
import { SessionSpecifications } from "../domain/session/session.specification.js";
import { TouchSessionCommand, type TouchSessionResult } from "./touch-session.command.js";

@CommandHandler(TouchSessionCommand)
export class TouchSessionHandler implements ICommandHandler<TouchSessionCommand> {
  constructor(
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: TouchSessionCommand): Promise<TouchSessionResult> {
    return this.unitOfWork.run<TouchSessionResult>(async () => {
      const found = await this.sessions.findOne(SessionSpecifications.withId(payload.sessionId));
      const session = found.isOk() ? found.unwrap() : null;
      if (session?.revokedAt !== null) return Ok(undefined);
      const now = new Date();
      const elapsedSeconds = (now.getTime() - session.lastUsedAt.getTime()) / 1000;
      if (elapsedSeconds < payload.thresholdSeconds) return Ok(undefined);
      await this.sessions.updateOne(
        SessionRootOps.touch({ session, now, ttlSeconds: payload.ttlSeconds }),
      );
      return Ok(undefined);
    });
  }
}
