import { z } from "zod";

export const TodoRow = z.object({
  id: z.guid(),
  organization_id: z.guid(),
  title: z.string(),
  completed: z.boolean(),
  created_at: z.date(),
  updated_at: z.date(),
});
export type TodoRow = z.infer<typeof TodoRow>;
