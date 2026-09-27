import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { FindApiTokenByHashHandler } from "./queries/find-api-token-by-hash.handler.js";
import { FindApiTokenByHashQuery } from "./queries/find-api-token-by-hash.query.js";
import { FindCurrentUserHandler } from "./queries/find-current-user.handler.js";
import { FindCurrentUserQuery } from "./queries/find-current-user.query.js";
import { FindSessionHandler } from "./queries/find-session.handler.js";
import { FindSessionQuery } from "./queries/find-session.query.js";
import { ListMyApiTokensHandler } from "./queries/list-my-api-tokens.handler.js";
import { ListMyApiTokensQuery } from "./queries/list-my-api-tokens.query.js";

export const authQueries = [
  FindSessionQuery,
  FindApiTokenByHashQuery,
  FindCurrentUserQuery,
  ListMyApiTokensQuery,
] as const;

export const authQueryHandlers = [
  FindSessionHandler,
  FindApiTokenByHashHandler,
  FindCurrentUserHandler,
  ListMyApiTokensHandler,
] as const;

export const authQuerySpanAttributes: MessageSpanAttributes = {
  FindSessionQuery: ({ payload }: FindSessionQuery) => ({ "session.id": payload.sessionId }),
  FindCurrentUserQuery: ({ payload }: FindCurrentUserQuery) => ({ "user.id": payload.userId }),
  ListMyApiTokensQuery: ({ payload }: ListMyApiTokensQuery) => ({ "user.id": payload.userId }),
};
