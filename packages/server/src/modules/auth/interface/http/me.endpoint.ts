import { Controller, Inject, UseGuards } from "@nestjs/common";
import { AuthContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";

import { FindCurrentUserQuery } from "@/modules/auth/queries/find-current-user.query.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow } from "@/platform/http/endpoint.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = AuthContract.PrivateGroup.routes.me;

@Controller()
@UseGuards(UserAuthGuard)
export class MeEndpoint {
  constructor(@Inject(AppQueryBus) private readonly queryBus: AppQueryBus) {}

  @Endpoint(route)
  public async me(@Caller() caller: CurrentUser): Promise<AuthContract.CurrentUserResponse> {
    const view = unwrapOrThrow(
      await this.queryBus.execute(new FindCurrentUserQuery({ userId: caller.userId })),
      {
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    return { userId: view.userId, isSuperAdmin: view.isSuperAdmin };
  }
}
