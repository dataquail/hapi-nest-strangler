import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err, Ok } from "oxide.ts";

import { Spec } from "@/platform/ddd/contracts/specification.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { TodoNotFound } from "../domain/todo/todo.errors.js";
import { TodoRootOps } from "../domain/todo/todo.root-ops.js";
import { TodosRepository } from "../domain/todo/todos.repository.js";
import { TodoSpecifications } from "../domain/todo/todos.specification.js";
import { CompleteTodoCommand, type CompleteTodoResult } from "./complete-todo.command.js";

@CommandHandler(CompleteTodoCommand)
export class CompleteTodoHandler implements ICommandHandler<CompleteTodoCommand> {
  constructor(
    @Inject(TodosRepository) private readonly todos: TodosRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: CompleteTodoCommand): Promise<CompleteTodoResult> {
    return this.unitOfWork.run<CompleteTodoResult>(async () => {
      const found = await this.todos.findOne(
        Spec.and(
          TodoSpecifications.withId(payload.todoId),
          TodoSpecifications.forOrganization(payload.organizationId),
        ),
      );
      if (found.isErr()) return found;
      const existing = found.unwrap();
      if (existing === null) return Err(new TodoNotFound({ todoId: payload.todoId }));
      const completed = TodoRootOps.complete(existing, new Date());
      const saved = await this.todos.updateOne(completed);
      if (saved.isErr()) return saved;
      return Ok(completed);
    });
  }
}
