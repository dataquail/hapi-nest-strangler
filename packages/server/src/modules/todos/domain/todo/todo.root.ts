import { z } from "zod";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "./todo.id.js";

// Aggregate root data — a dumb value (ADR-0003). Every todo is scoped to
// exactly one organization; the repository requires it on every read/mutate so
// cross-tenant access cannot leak.
export const TodoRoot = z
  .object({
    id: TodoId,
    organizationId: OrganizationId,
    title: z.string(),
    completed: z.boolean(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .readonly();
export type TodoRoot = z.infer<typeof TodoRoot>;
