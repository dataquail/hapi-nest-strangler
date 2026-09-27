import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { UserNotFound } from "../domain/user/user.errors.js";
import { UserRepository } from "../domain/user/user.repository.js";
import { UserRootOps } from "../domain/user/user.root-ops.js";
import { UserSpecifications } from "../domain/user/user.specification.js";
import { DeleteUserCommand, type DeleteUserResult } from "./delete-user.command.js";

@CommandHandler(DeleteUserCommand)
export class DeleteUserHandler implements ICommandHandler<DeleteUserCommand> {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: DeleteUserCommand): Promise<DeleteUserResult> {
    return this.unitOfWork.run<DeleteUserResult>(async () => {
      const found = await this.users.findOne(UserSpecifications.withId(payload.userId));
      if (found.isErr()) return found;
      const user = found.unwrap();
      if (user === null) return Err(new UserNotFound({ userId: payload.userId }));
      const { events } = UserRootOps.markDeleted(user);
      const deleted = await this.users.deleteOne(user.id);
      if (deleted.isErr()) return deleted;
      await this.events.dispatch(events);
      return Ok(undefined);
    });
  }
}
