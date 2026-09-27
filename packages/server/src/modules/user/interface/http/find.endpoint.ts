import { Controller, Inject, Query, UseGuards } from "@nestjs/common";
import { UserContract } from "@org/contracts/api/Contracts";

import {
  FindUsersQuery,
  type FindUsersResultView,
} from "@/modules/user/queries/find-users.query.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const toContract = (result: FindUsersResultView): UserContract.PaginatedUsers => ({
  users: result.users.map((user) => ({
    id: user.id,
    email: user.email,
    address: user.address,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  })),
  page: result.page,
  pageSize: result.pageSize,
  total: result.total,
});

@Controller()
@UseGuards(UserAuthGuard)
export class FindUsersEndpoint {
  constructor(@Inject(AppQueryBus) private readonly queryBus: AppQueryBus) {}

  @Endpoint(UserContract.Group.routes.find)
  public async find(
    @Query(zodPipe(UserContract.FindUsersParams)) query: UserContract.FindUsersParams,
  ): Promise<UserContract.PaginatedUsers> {
    const result = await this.queryBus.execute(
      new FindUsersQuery({ page: query.page, pageSize: query.pageSize }),
    );
    return toContract(unwrapOrThrow(result, { PersistenceUnavailable: serviceUnavailable }));
  }
}
