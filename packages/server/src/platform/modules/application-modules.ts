import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { EnvModule } from "@/common/env.module.js";
import { BillingModule } from "@/modules/billing/billing.platform.js";
import { TodosModule } from "@/modules/todos/todos.platform.js";
import { WalletModule } from "@/modules/wallet/wallet.platform.js";
import { CqrsRuntimeModule } from "@/platform/cqrs/cqrs-runtime.js";
import { DatabaseModule } from "@/platform/database/database.module.js";
import { ProblemFilter } from "@/platform/http/problem.filter.js";

import { AuthzModule } from "./authz.module.js";

// The application, assembled once and identical in both composition roots.
// What differs between them is the environment each overrides: the database,
// the environment variables and the user auth guard. The strangler adds a
// module here, one line each, as it leaves the legacy API.
@Module({
  imports: [
    EnvModule,
    DatabaseModule,
    CqrsRuntimeModule,
    AuthzModule,
    WalletModule,
    TodosModule,
    BillingModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ProblemFilter }],
})
export class AppModule {}
