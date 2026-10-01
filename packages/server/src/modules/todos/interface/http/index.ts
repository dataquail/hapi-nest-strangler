import { CreateTodoEndpoint } from "./create.endpoint.js";
import { DeleteTodoEndpoint } from "./delete.endpoint.js";
import { GetTodosEndpoint } from "./get.endpoint.js";
import { UpdateTodoEndpoint } from "./update.endpoint.js";

export const todosEndpoints = [
  GetTodosEndpoint,
  CreateTodoEndpoint,
  UpdateTodoEndpoint,
  DeleteTodoEndpoint,
] as const;
