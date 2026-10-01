import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";

import type { TodoId } from "./todo.id.js";

export class TodoNotFound extends TaggedError("TodoNotFound")<{ readonly todoId: TodoId }> {}

export class TodoAlreadyExists extends TaggedError("TodoAlreadyExists")<{
  readonly todoId: TodoId;
}> {}
