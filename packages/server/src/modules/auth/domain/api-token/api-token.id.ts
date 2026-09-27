import { z } from "zod";

export const ApiTokenId = z.guid().brand<"ApiTokenId">();
export type ApiTokenId = z.infer<typeof ApiTokenId>;
