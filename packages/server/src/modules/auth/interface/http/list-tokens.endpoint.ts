import { Controller, Inject, UseGuards } from "@nestjs/common";
import { AuthContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";

import {
  type ApiTokenView,
  ListMyApiTokensQuery,
} from "@/modules/auth/queries/list-my-api-tokens.query.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow } from "@/platform/http/endpoint.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = AuthContract.TokensGroup.routes.list;

const toSummary = (view: ApiTokenView): AuthContract.ApiTokenSummary => ({
  id: view.id,
  label: view.label,
  prefix: view.prefix,
  expiresAt: view.expiresAt === null ? null : view.expiresAt.toISOString(),
  createdAt: view.createdAt.toISOString(),
  lastUsedAt: view.lastUsedAt.toISOString(),
});

@Controller()
@UseGuards(UserAuthGuard)
export class ListTokensEndpoint {
  constructor(@Inject(AppQueryBus) private readonly queryBus: AppQueryBus) {}

  @Endpoint(route)
  public async list(
    @Caller() caller: CurrentUser,
  ): Promise<ReadonlyArray<AuthContract.ApiTokenSummary>> {
    const views = unwrapOrThrow(
      await this.queryBus.execute(new ListMyApiTokensQuery({ userId: caller.userId })),
      {
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return views.map(toSummary);
  }
}
