import { z } from "zod";

import { UserId } from "@/platform/ids/user-id.js";

import { RoleValueObject } from "./role.value-object.js";

// Aggregate root data — a dumb value (ADR-0003). Operations live in
// `roles.root-ops.ts`.
export const RolesRoot = z
  .object({
    userId: UserId,
    roles: z.array(RoleValueObject).readonly(),
  })
  .readonly();
export type RolesRoot = z.infer<typeof RolesRoot>;
