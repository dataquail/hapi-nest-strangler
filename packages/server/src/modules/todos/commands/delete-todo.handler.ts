import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { TodosRepository } from "../domain/todo/todos.repository.js";
import { DeleteTodoCommand, type DeleteTodoResult } from "./delete-todo.command.js";

@CommandHandler(DeleteTodoCommand)
export class DeleteTodoHandler implements ICommandHandler<DeleteTodoCommand> {
  constructor(
    @Inject(TodosRepository) private readonly todos: TodosRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: DeleteTodoCommand): Promise<DeleteTodoResult> {
    return this.unitOfWork.run<DeleteTodoResult>(() =>
      this.todos.deleteOne(payload.organizationId, payload.todoId),
    );
  }
}
