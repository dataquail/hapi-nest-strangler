import { z } from "zod";

export const TodoId = z.guid().brand<"TodoId">();
export type TodoId = z.infer<typeof TodoId>;
