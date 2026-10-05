import { Inject, Injectable } from "@nestjs/common";
import { Err, Ok } from "oxide.ts";

import type { Resolver } from "@/platform/auth/authz.js";
import { resourceNotFound } from "@/platform/auth/authz.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { TodoId } from "../domain/todo/todo.id.js";
import { FindTodoOrganizationQuery } from "../queries/find-todo-organization.query.js";

export type TodoOrgContext = { readonly organizationId: OrganizationId };
export type TodoResourceId = {
  readonly organizationId: OrganizationId;
  readonly todoId: TodoId;
};

declare module "@org/authz/resource-resolver-registry" {
  interface ResourceResolverMap {
    todoCollection: { resourceType: TodoOrgContext; idType: OrganizationId; notFound: never };
    todo: { resourceType: TodoOrgContext; idType: TodoResourceId };
  }
}

// An echo resolver: the collection's identity is the org id itself, so it has nothing to load.
@Injectable()
export class TodoCollectionResolverEntry {
  public readonly resolve: Resolver<"todoCollection"> = (organizationId) =>
    Promise.resolve(Ok({ organizationId }));
}

@Injectable()
export class TodoResolverEntry {
  constructor(@Inject(AppQueryBus) private readonly queries: AppQueryBus) {}

  public readonly resolve: Resolver<"todo"> = async ({ organizationId, todoId }) => {
    const found = await this.queries.execute(
      new FindTodoOrganizationQuery({ organizationId, todoId }),
    );
    if (found.isErr()) return found;
    const view = found.unwrap();
    return view === null ? Err(resourceNotFound()) : Ok(view);
  };
}
