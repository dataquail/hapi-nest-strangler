import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { actionConstants } from "../../constants/acl/action-constants";
import { resourceConstants } from "../../constants/acl/resource-constants";
import { roleConstants } from "../../constants/acl/role-constants";
import { can } from "./can";

const CONTINUE = Symbol("continue");
const h = { continue: CONTINUE } as any;

const userWith = (roles: string[]) => ({
  getRoleId: () => [roleConstants.USER, ...roles],
  getResourceId: () => resourceConstants.USER,
});

const requestFor = (user: unknown, params: Record<string, unknown> = {}) =>
  ({ auth: { credentials: { user } }, params, headers: {} }) as any;

describe("can", () => {
  it("lets a signed-in user manage the user directory", async () => {
    const result = await can(actionConstants.LIST, resourceConstants.USER)(
      requestFor(userWith([])),
      h,
    );
    deepStrictEqual(result, CONTINUE);
  });

  it("denies an action no rule grants, and lets a super admin through anyway", async () => {
    const denied: any = await can(actionConstants.MANAGE_BILLING, resourceConstants.ORGANIZATION)(
      requestFor(userWith([])),
      h,
    );
    deepStrictEqual(denied.output.statusCode, 403);
    const allowed = await can(actionConstants.MANAGE_BILLING, resourceConstants.ORGANIZATION)(
      requestFor(userWith([roleConstants.SUPER_ADMIN])),
      h,
    );
    deepStrictEqual(allowed, CONTINUE);
  });

  it("reads the resource off the request when given a path", async () => {
    const target = userWith([]);
    const result = await can(actionConstants.DELETE, "params.user")(
      requestFor(userWith([]), { user: target }),
      h,
    );
    deepStrictEqual(result, CONTINUE);
  });

  it("forbids when there is no user and waves a machine caller through", async () => {
    const noUser: any = await can(actionConstants.LIST, resourceConstants.USER)(
      requestFor(undefined),
      h,
    );
    deepStrictEqual(noUser.output.statusCode, 403);
    const machine = await can(actionConstants.LIST, resourceConstants.USER)(
      requestFor({ authType: "MACHINE" }),
      h,
    );
    deepStrictEqual(machine, CONTINUE);
  });
});
