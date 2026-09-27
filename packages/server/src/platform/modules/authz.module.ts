import { Global, Module } from "@nestjs/common";
import { makePolicyRegistry, makeResourceResolverRegistry } from "@org/authz";

import {
  BillingModule,
  BillingPolicyContribution,
  BillingResolverEntry,
} from "@/modules/billing/billing.platform.js";
import {
  OrganizationModule,
  OrganizationPolicyContribution,
  OrganizationResolverEntry,
} from "@/modules/organization/organization.platform.js";
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

// Every endpoint names the guard and the authorizer, so both are global. The
// registries are folded here from each module's contribution: adding a module
// with policies means one import and one entry in each factory.
@Global()
@Module({
  imports: [OrganizationModule, TodosModule, BillingModule],
  providers: [
    CookieCodec,
    { provide: Authenticator, useClass: AuthenticatorLive },
    UserAuthGuard,
    {
      provide: PolicyRegistry,
      inject: [OrganizationPolicyContribution, TodoPolicyContribution, BillingPolicyContribution],
      useFactory: (
        organization: OrganizationPolicyContribution,
        todos: TodoPolicyContribution,
        billing: BillingPolicyContribution,
      ) =>
        makePolicyRegistry([organization.contribution, todos.contribution, billing.contribution]),
    },
    {
      provide: ResourceResolverRegistry,
      inject: [
        OrganizationResolverEntry,
        TodoCollectionResolverEntry,
        TodoResolverEntry,
        BillingResolverEntry,
      ],
      useFactory: (
        organization: OrganizationResolverEntry,
        todoCollection: TodoCollectionResolverEntry,
        todo: TodoResolverEntry,
        billing: BillingResolverEntry,
      ) =>
        makeResourceResolverRegistry({
          organization: organization.resolve,
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
