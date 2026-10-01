import { CliCompleteTodoEndpoint } from "./complete.endpoint.js";
import { CliCreateTodoEndpoint } from "./create.endpoint.js";
import { CliListTodosEndpoint } from "./list.endpoint.js";
import { CliRemoveTodoEndpoint } from "./remove.endpoint.js";

export const todosCliEndpoints = [
  CliListTodosEndpoint,
  CliCreateTodoEndpoint,
  CliCompleteTodoEndpoint,
  CliRemoveTodoEndpoint,
] as const;
