import { z } from "zod";

export const RoleValueObject = z.literal("super_admin");
export type RoleValueObject = z.infer<typeof RoleValueObject>;
