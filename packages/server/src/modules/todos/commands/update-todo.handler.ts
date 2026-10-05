import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { TodoNotFound } from "../domain/todo/todo.errors.js";
import { TodoRootOps } from "../domain/todo/todo.root-ops.js";
import { TodosRepository } from "../domain/todo/todos.repository.js";
import { TodoSpecifications } from "../domain/todo/todos.specification.js";
import { UpdateTodoCommand, type UpdateTodoResult } from "./update-todo.command.js";

@CommandHandler(UpdateTodoCommand)
export class UpdateTodoHandler implements ICommandHandler<UpdateTodoCommand> {
  constructor(
    @Inject(TodosRepository) private readonly todos: TodosRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: UpdateTodoCommand): Promise<UpdateTodoResult> {
    return this.unitOfWork.run<UpdateTodoResult>(async () => {
      const found = await this.todos.findOne(
        Spec.and(
          TodoSpecifications.withId(payload.todoId),
          TodoSpecifications.forOrganization(payload.organizationId),
        ),
      );
      if (found.isErr()) return found;
      const existing = found.unwrap();
      if (existing === null) return Err(new TodoNotFound({ todoId: payload.todoId }));
      const updated = TodoRootOps.update(existing, {
        title: payload.title,
        completed: payload.completed,
        now: new Date(),
      });
      const saved = await this.todos.updateOne(updated);
      if (saved.isErr()) return saved;
      return Ok(updated);
    });
  }
}
