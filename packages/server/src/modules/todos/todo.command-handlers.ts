import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { CompleteTodoCommand } from "./commands/complete-todo.command.js";
import { CompleteTodoHandler } from "./commands/complete-todo.handler.js";
import { CreateTodoCommand } from "./commands/create-todo.command.js";
import { CreateTodoHandler } from "./commands/create-todo.handler.js";
import { DeleteTodoCommand } from "./commands/delete-todo.command.js";
import { DeleteTodoHandler } from "./commands/delete-todo.handler.js";
import { UpdateTodoCommand } from "./commands/update-todo.command.js";
import { UpdateTodoHandler } from "./commands/update-todo.handler.js";

export const todoCommands = [
  CreateTodoCommand,
  UpdateTodoCommand,
  CompleteTodoCommand,
  DeleteTodoCommand,
] as const;

export const todoCommandHandlers = [
  CreateTodoHandler,
  UpdateTodoHandler,
  CompleteTodoHandler,
  DeleteTodoHandler,
] as const;

export const todoCommandSpanAttributes: MessageSpanAttributes = {
  CreateTodoCommand: ({ payload }: CreateTodoCommand) => ({
    "organization.id": payload.organizationId,
  }),
  UpdateTodoCommand: ({ payload }: UpdateTodoCommand) => ({
    "todo.id": payload.todoId,
    "organization.id": payload.organizationId,
    "todo.completed": payload.completed,
  }),
  CompleteTodoCommand: ({ payload }: CompleteTodoCommand) => ({
    "todo.id": payload.todoId,
    "organization.id": payload.organizationId,
  }),
  DeleteTodoCommand: ({ payload }: DeleteTodoCommand) => ({
    "todo.id": payload.todoId,
    "organization.id": payload.organizationId,
  }),
};
