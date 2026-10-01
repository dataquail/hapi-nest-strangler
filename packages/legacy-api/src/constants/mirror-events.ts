// hapi server events the mirror plugin forwards to the Nest server while a
// module is dual-written; a service emits one once its row is written.
export const mirrorEvents = {
  TODO_CREATED: "mirror-todo-created",
  TODO_UPDATED: "mirror-todo-updated",
  TODO_COMPLETED: "mirror-todo-completed",
  TODO_DELETED: "mirror-todo-deleted",
} as const;
