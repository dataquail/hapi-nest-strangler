import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { CurrentUser } from "@org/contracts/Policy";

import type { AuthenticatedRequest } from "@/platform/auth/caller.decorator.js";
import { UserId } from "@/platform/ids/user-id.js";

// Paired with a platform.roles seed in useServerTestRuntime so the role lookup
// surfaces this caller as super_admin.
export const SUPER_ADMIN_CALLER_ID = UserId.parse("00000000-0000-0000-0000-000000000001");
export const MEMBER_CALLER_ID = UserId.parse("00000000-0000-0000-0000-000000000002");

export const SUPER_ADMIN_CALLER: CurrentUser = {
  sessionId: "test-session",
  userId: SUPER_ADMIN_CALLER_ID,
};
export const MEMBER_CALLER: CurrentUser = { sessionId: "test-session", userId: MEMBER_CALLER_ID };

/** Attaches a fixed caller to every request; endpoint tests do not carry a cookie. */
export class UserAuthGuardFake implements CanActivate {
  constructor(private readonly caller: CurrentUser) {}

  public canActivate(context: ExecutionContext): boolean {
    context.switchToHttp().getRequest<AuthenticatedRequest>().currentUser = this.caller;
    return true;
  }
}
