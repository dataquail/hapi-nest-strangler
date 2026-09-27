import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { TodoId } from "../domain/todo/todo.id.js";
import { TodoRootOps } from "../domain/todo/todo.root-ops.js";
import { TodosRepository } from "../domain/todo/todos.repository.js";
import { CreateTodoCommand, type CreateTodoResult } from "./create-todo.command.js";

@CommandHandler(CreateTodoCommand)
export class CreateTodoHandler implements ICommandHandler<CreateTodoCommand> {
  constructor(
    @Inject(TodosRepository) private readonly todos: TodosRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: CreateTodoCommand): Promise<CreateTodoResult> {
    return this.unitOfWork.run<CreateTodoResult>(async () => {
      const todo = TodoRootOps.create({
        id: TodoId.parse(crypto.randomUUID()),
        organizationId: payload.organizationId,
        title: payload.title,
        now: new Date(),
      });
      const inserted = await this.todos.insertOne(todo);
      if (inserted.isErr()) return inserted;
      return Ok(todo);
    });
  }
}
