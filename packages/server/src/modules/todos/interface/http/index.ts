import { CreateTodoEndpoint } from "./create.endpoint.js";
import { DeleteTodoEndpoint } from "./delete.endpoint.js";
import { GetTodosEndpoint } from "./get.endpoint.js";
import { InternalCompleteTodoEndpoint } from "./internal-complete.endpoint.js";
import { InternalCreateTodoEndpoint } from "./internal-create.endpoint.js";
import { InternalDeleteTodoEndpoint } from "./internal-delete.endpoint.js";
import { InternalUpdateTodoEndpoint } from "./internal-update.endpoint.js";
import { UpdateTodoEndpoint } from "./update.endpoint.js";

export const todosEndpoints = [
  GetTodosEndpoint,
  CreateTodoEndpoint,
  UpdateTodoEndpoint,
  DeleteTodoEndpoint,
  InternalCreateTodoEndpoint,
  InternalUpdateTodoEndpoint,
  InternalCompleteTodoEndpoint,
  InternalDeleteTodoEndpoint,
] as const;
