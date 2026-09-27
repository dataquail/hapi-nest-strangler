import type { TodosContract } from "@org/contracts/api/Contracts";
import { OrganizationId, TodoId } from "@org/contracts/EntityIds";

const DEFAULT_TODO_ID = TodoId.parse("33333333-3333-3333-3333-333333333333");

/** The org every todos test is scoped to, unless it says otherwise. */
export const TEST_ORG_ID = OrganizationId.parse("44444444-4444-4444-4444-444444444444");

export const makeTodo = (overrides: Partial<TodosContract.Todo> = {}): TodosContract.Todo => ({
  id: DEFAULT_TODO_ID,
  title: "Buy milk",
  completed: false,
  ...overrides,
});

export const makeCreateTodoPayload = (
  overrides: Partial<TodosContract.CreateTodoPayload> = {},
): TodosContract.CreateTodoPayload => ({ title: "Walk the dog", ...overrides });
