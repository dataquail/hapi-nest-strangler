import { Controller, Inject, Param, UseGuards } from "@nestjs/common";
import { TodosContract } from "@org/contracts/api/Contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { z } from "zod";

import { TodoCollectionResource } from "@/modules/todos/policies/todos.policies.js";
import {
  ListTodosQuery,
  type ListTodosTodoView,
} from "@/modules/todos/queries/list-todos.query.js";
import { Actions } from "@/platform/auth/actions.js";
import { Authz } from "@/platform/auth/authz.js";
import { Caller } from "@/platform/auth/caller.decorator.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow, zodPipe } from "@/platform/http/endpoint.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";

const route = TodosContract.Group.routes.get;

const toContract = (view: ListTodosTodoView): TodosContract.Todo => ({
  id: view.id,
  title: view.title,
  completed: view.completed,
});

@Controller()
@UseGuards(UserAuthGuard)
export class GetTodosEndpoint {
  constructor(
    @Inject(AppQueryBus) private readonly queryBus: AppQueryBus,
    @Inject(Authz) private readonly authz: Authz,
  ) {}

  @Endpoint(route)
  public async get(
    @Caller() caller: CurrentUser,
    @Param(zodPipe(route.params)) params: z.infer<typeof route.params>,
  ): Promise<ReadonlyArray<TodosContract.Todo>> {
    unwrapOrThrow(
      await this.authz.hasPermissions(caller, TodoCollectionResource, Actions.Read, params.orgId),
      { PersistenceUnavailable: serviceUnavailable },
    );
    const result = unwrapOrThrow(
      await this.queryBus.execute(new ListTodosQuery({ organizationId: params.orgId })),
      { PersistenceUnavailable: serviceUnavailable },
    );
    return result.todos.map(toContract);
  }
}
