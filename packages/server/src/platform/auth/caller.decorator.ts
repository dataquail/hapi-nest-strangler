import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { CurrentUser } from "@org/contracts/Policy";
import type { Request } from "express";

export type AuthenticatedRequest = Request & { currentUser?: CurrentUser | undefined };

/** The caller the auth guard attached to the request. Only meaningful behind `UserAuthGuard`. */
export const Caller = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.currentUser === undefined) {
      throw new Error("@Caller() used on a route without UserAuthGuard");
    }
    return request.currentUser;
  },
);
