import { Global, Module } from "@nestjs/common";
import { makePolicyRegistry, makeResourceResolverRegistry } from "@org/authz";

import {
  BillingModule,
  BillingPolicyContribution,
  BillingResolverEntry,
} from "@/modules/billing/billing.platform.js";
import {
  TodoCollectionResolverEntry,
  TodoPolicyContribution,
  TodoResolverEntry,
  TodosModule,
} from "@/modules/todos/todos.platform.js";
import { Authenticator } from "@/platform/auth/authenticator.js";
import { Authz, PolicyRegistry, ResourceResolverRegistry } from "@/platform/auth/authz.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { AuthenticatorLive } from "@/platform/middlewares/authenticator-live.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

// Every user-facing endpoint names the guard and the authorizer, so both are
// global. The registries are folded here from each module's contribution:
// adding a module with policies means one import and one entry in each factory.
@Global()
@Module({
  imports: [TodosModule, BillingModule],
  providers: [
    CookieCodec,
    { provide: Authenticator, useClass: AuthenticatorLive },
    UserAuthGuard,
    {
      provide: PolicyRegistry,
      inject: [TodoPolicyContribution, BillingPolicyContribution],
      useFactory: (todos: TodoPolicyContribution, billing: BillingPolicyContribution) =>
        makePolicyRegistry([todos.contribution, billing.contribution]),
    },
    {
      provide: ResourceResolverRegistry,
      inject: [TodoCollectionResolverEntry, TodoResolverEntry, BillingResolverEntry],
      useFactory: (
        todoCollection: TodoCollectionResolverEntry,
        todo: TodoResolverEntry,
        billing: BillingResolverEntry,
      ) =>
        makeResourceResolverRegistry({
          todoCollection: todoCollection.resolve,
          todo: todo.resolve,
          billing: billing.resolve,
        }),
    },
    Authz,
  ],
  exports: [CookieCodec, Authenticator, UserAuthGuard, Authz],
})
export class AuthzModule {}
