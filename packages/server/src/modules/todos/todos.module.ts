import { Module } from "@nestjs/common";

import { TodosRepository } from "./domain/todo/todos.repository.js";
import { TodosRepositoryLive } from "./infrastructure/repositories/todos.repository-live.js";

// The module's shell: its domain and its own table, with no use case or
// endpoint yet. The legacy API still serves todos; what arrives here next is
// the internal write API the legacy API will forward to.
@Module({
  providers: [{ provide: TodosRepository, useClass: TodosRepositoryLive }],
})
export class TodosModule {}
