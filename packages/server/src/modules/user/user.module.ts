import { Module } from "@nestjs/common";

import { UserRepository } from "./domain/user/user.repository.js";
import { UserRepositoryLive } from "./infrastructure/repositories/user.repository-live.js";
import { userEndpoints } from "./interface/http/index.js";
import { userCommandHandlers } from "./user.command-handlers.js";
import { userQueryHandlers } from "./user.query-handlers.js";

@Module({
  controllers: [...userEndpoints],
  providers: [
    ...userCommandHandlers,
    ...userQueryHandlers,
    { provide: UserRepository, useClass: UserRepositoryLive },
  ],
})
export class UserModule {}
