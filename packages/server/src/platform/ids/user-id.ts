import { z } from "zod";

export const UserId = z.guid().brand<"UserId">();
export type UserId = z.infer<typeof UserId>;
