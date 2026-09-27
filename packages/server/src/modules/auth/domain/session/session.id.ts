import { z } from "zod";

export const SessionId = z.guid().brand<"SessionId">();
export type SessionId = z.infer<typeof SessionId>;
