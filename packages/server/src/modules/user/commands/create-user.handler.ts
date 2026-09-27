import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

import { UserRepository } from "../domain/user/user.repository.js";
import { UserRootOps } from "../domain/user/user.root-ops.js";
import { CreateUserCommand, type CreateUserResult } from "./create-user.command.js";

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: CreateUserCommand): Promise<CreateUserResult> {
    return this.unitOfWork.run<CreateUserResult>(async () => {
      const id = UserId.parse(crypto.randomUUID());
      const now = new Date();
      const address =
        payload.country !== undefined &&
        payload.street !== undefined &&
        payload.postalCode !== undefined
          ? { country: payload.country, street: payload.street, postalCode: payload.postalCode }
          : null;
      const { events, user } = UserRootOps.create({ id, email: payload.email, address, now });
      const inserted = await this.users.insertOne(user);
      if (inserted.isErr()) return inserted;
      await this.events.dispatch(events);
      return Ok(user.id);
    });
  }
}
