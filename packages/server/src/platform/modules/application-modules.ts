import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { EnvModule } from "@/common/env.module.js";
import { WalletModule } from "@/modules/wallet/wallet.platform.js";
import { CqrsRuntimeModule } from "@/platform/cqrs/cqrs-runtime.js";
import { DatabaseModule } from "@/platform/database/database.module.js";
import { ProblemFilter } from "@/platform/http/problem.filter.js";

import { AuthzModule } from "./authz.module.js";

// The application, assembled once and identical in both composition roots.
// What differs between them is the environment each overrides: the database
// and the environment variables. One module today; the strangler adds the
// rest here, one line each, as they leave the legacy API.
@Module({
  imports: [EnvModule, DatabaseModule, CqrsRuntimeModule, AuthzModule, WalletModule],
  providers: [{ provide: APP_FILTER, useClass: ProblemFilter }],
})
export class AppModule {}
