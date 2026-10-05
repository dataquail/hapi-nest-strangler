import { Inject, Injectable } from "@nestjs/common";

import { Check, type CheckFor, type PolicyContribution } from "@/platform/auth/authz.js";

import { OrganizationAccess } from "../domain/ports/acl/organization-access.acl.js";
import { PlatformRoles } from "../domain/ports/acl/platform-roles.acl.js";
import { makeIsTodoOrgMember } from "./is-todo-org-member.policy.js";
import { makeIsTodoSuperAdmin } from "./is-todo-super-admin.policy.js";

declare module "@org/authz/policy-registry" {
  interface PolicyMap {
    todoCollection: {
      create: CheckFor<"todoCollection">;
      read: CheckFor<"todoCollection">;
    };
    todo: {
      update: CheckFor<"todo">;
      delete: CheckFor<"todo">;
    };
  }
}

export const TodoCollectionResource = "todoCollection" as const;
export const TodoResource = "todo" as const;

// A check takes its data source as an argument and this contribution closes
// over the module's own ACL ports, so every registered check is fully closed.
@Injectable()
export class TodoPolicyContribution {
  public readonly contribution: PolicyContribution;

  constructor(
    @Inject(PlatformRoles) roles: PlatformRoles,
    @Inject(OrganizationAccess) organizations: OrganizationAccess,
  ) {
    const todoMemberCheck = Check.any(
      makeIsTodoSuperAdmin(roles),
      makeIsTodoOrgMember(organizations),
    );
    this.contribution = {
      todoCollection: { create: todoMemberCheck, read: todoMemberCheck },
      todo: { update: todoMemberCheck, delete: todoMemberCheck },
    };
  }
}
