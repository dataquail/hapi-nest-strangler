import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";

import { EnvModule } from "@/common/env.module.js";
import { AuthModule } from "@/modules/auth/auth.platform.js";
import { BillingModule } from "@/modules/billing/billing.platform.js";
import { OrganizationModule } from "@/modules/organization/organization.platform.js";
import { RoleModule } from "@/modules/role/role.platform.js";
import { TodosModule } from "@/modules/todos/todos.platform.js";
import { UserModule } from "@/modules/user/user.platform.js";
import { WalletModule } from "@/modules/wallet/wallet.platform.js";
import { CqrsRuntimeModule } from "@/platform/cqrs/cqrs-runtime.js";
import { DatabaseModule } from "@/platform/database/database.module.js";
import { OpenApiController } from "@/platform/http/openapi.controller.js";
import { ProblemFilter } from "@/platform/http/problem.filter.js";
import { NotificationsModule } from "@/platform/notifications/notifications.module.js";

import { AuthzModule } from "./authz.module.js";
import { BillingGatewayModule } from "./billing-gateway.module.js";

// The application, assembled once and identical in both composition roots.
// What differs between them is the environment each overrides: the database,
// the auth guard, the mailer, and billing's gateway.
@Module({
  imports: [
    EnvModule,
    DatabaseModule,
    NotificationsModule,
    CqrsRuntimeModule,
    AuthzModule,
    BillingGatewayModule,
    UserModule,
    RoleModule,
    OrganizationModule,
    TodosModule,
    AuthModule,
    BillingModule,
    WalletModule,
  ],
  controllers: [OpenApiController],
  providers: [{ provide: APP_FILTER, useClass: ProblemFilter }],
})
export class AppModule {}
