import { z } from "zod";

export const InvitationId = z.guid().brand<"InvitationId">();
export type InvitationId = z.infer<typeof InvitationId>;
