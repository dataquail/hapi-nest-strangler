import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { FindUserRolesHandler } from "./queries/find-user-roles.handler.js";
import { FindUserRolesQuery } from "./queries/find-user-roles.policy-query.js";

export const roleQueries = [FindUserRolesQuery] as const;

export const roleQueryHandlers = [FindUserRolesHandler] as const;

export const roleQuerySpanAttributes: MessageSpanAttributes = {
  FindUserRolesQuery: ({ payload }: FindUserRolesQuery) => ({ "user.id": payload.userId }),
};
