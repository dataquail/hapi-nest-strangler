import { CreateUserCommand } from "./commands/create-user.command.js";
import { UserAlreadyExists } from "./domain/user/user.errors.js";
import { FindUsersByIdsQuery } from "./queries/find-users-by-ids.query.js";

export const userAccessCommands = { CreateUserCommand } as const;

export const userAccessQueries = { FindUsersByIdsQuery } as const;

export const userAccessErrors = { UserAlreadyExists } as const;
