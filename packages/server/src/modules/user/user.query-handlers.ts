import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { FindUsersHandler } from "./queries/find-users.handler.js";
import { FindUsersQuery } from "./queries/find-users.query.js";
import { FindUsersByIdsHandler } from "./queries/find-users-by-ids.handler.js";
import { FindUsersByIdsQuery } from "./queries/find-users-by-ids.query.js";

export const userQueries = [FindUsersQuery, FindUsersByIdsQuery] as const;

export const userQueryHandlers = [FindUsersHandler, FindUsersByIdsHandler] as const;

export const userQuerySpanAttributes: MessageSpanAttributes = {
  FindUsersQuery: ({ payload }: FindUsersQuery) => ({
    "query.page": payload.page,
    "query.pageSize": payload.pageSize,
  }),
  FindUsersByIdsQuery: ({ payload }: FindUsersByIdsQuery) => ({
    "query.id.count": payload.ids.length,
  }),
};
