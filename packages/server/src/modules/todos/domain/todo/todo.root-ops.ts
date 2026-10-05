import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { TodoId } from "./todo.id.js";
import { TodoRoot } from "./todo.root.js";

export type CreateInput = {
  readonly id: TodoId;
  readonly organizationId: OrganizationId;
  readonly title: string;
  readonly now: Date;
};

const create = (input: CreateInput): TodoRoot =>
  TodoRoot.parse({
    id: input.id,
    organizationId: input.organizationId,
    title: input.title,
    completed: false,
    createdAt: input.now,
    updatedAt: input.now,
  });

export type UpdateInput = {
  readonly title: string;
  readonly completed: boolean;
  readonly now: Date;
};

const update = (todo: TodoRoot, input: UpdateInput): TodoRoot =>
  TodoRoot.parse({
    id: todo.id,
    organizationId: todo.organizationId,
    title: input.title,
    completed: input.completed,
    createdAt: todo.createdAt,
    updatedAt: input.now,
  });

// Idempotent: completing a done todo re-stamps updatedAt.
const complete = (todo: TodoRoot, now: Date): TodoRoot =>
  TodoRoot.parse({
    id: todo.id,
    organizationId: todo.organizationId,
    title: todo.title,
    completed: true,
    createdAt: todo.createdAt,
    updatedAt: now,
  });

export const TodoRootOps = { create, update, complete } as const;
