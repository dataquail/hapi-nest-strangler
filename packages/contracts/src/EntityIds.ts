import { z } from "zod";

export const UserId = z.guid().brand<"UserId">();
export type UserId = z.infer<typeof UserId>;

export const TodoId = z.guid().brand<"TodoId">();
export type TodoId = z.infer<typeof TodoId>;

export const OrganizationId = z.guid().brand<"OrganizationId">();
export type OrganizationId = z.infer<typeof OrganizationId>;

export const InvitationId = z.guid().brand<"InvitationId">();
export type InvitationId = z.infer<typeof InvitationId>;

export const SubscriptionId = z.guid().brand<"SubscriptionId">();
export type SubscriptionId = z.infer<typeof SubscriptionId>;

export const ApiTokenId = z.guid().brand<"ApiTokenId">();
export type ApiTokenId = z.infer<typeof ApiTokenId>;
