import { InternalCompleteTodoEndpoint } from "./internal-complete.endpoint.js";
import { InternalCreateTodoEndpoint } from "./internal-create.endpoint.js";
import { InternalDeleteTodoEndpoint } from "./internal-delete.endpoint.js";
import { InternalUpdateTodoEndpoint } from "./internal-update.endpoint.js";

export const todosEndpoints = [
  InternalCreateTodoEndpoint,
  InternalUpdateTodoEndpoint,
  InternalCompleteTodoEndpoint,
  InternalDeleteTodoEndpoint,
] as const;
