import { Module } from "@nestjs/common";

import { TodosRepository } from "./domain/todo/todos.repository.js";
import { TodosRepositoryLive } from "./infrastructure/repositories/todos.repository-live.js";
import { todosEndpoints } from "./interface/http/index.js";
import { todoCommandHandlers } from "./todo.command-handlers.js";

// The legacy API still serves todos and mirrors every write to the internal
// endpoints here; the user-facing endpoints arrive when it stops.
@Module({
  controllers: [...todosEndpoints],
  providers: [...todoCommandHandlers, { provide: TodosRepository, useClass: TodosRepositoryLive }],
})
export class TodosModule {}
