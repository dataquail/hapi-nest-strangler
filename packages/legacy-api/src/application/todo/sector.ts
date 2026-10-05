// The strangler campaign's marker: every file that moves with this module, on both servers.
export const sector = {
  name: "todo",
  owns: [
    "packages/legacy-api/src/application/todo/**",
    "packages/legacy-api/test/application/todo/**",
    "packages/legacy-api/migrations/*_todos.ts",
    "packages/legacy-api/src/lib/backend-client/domains/todos.ts",
    "packages/server/src/modules/todos/**",
  ],
};
