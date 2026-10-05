import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";

import { Authenticator } from "@/platform/auth/authenticator.js";
import type { AuthenticatedRequest } from "@/platform/auth/caller.decorator.js";

const BEARER_PREFIX = /^Bearer\s+/i;

const readBearer = (authorization: string | undefined): string | null => {
  if (authorization === undefined) return null;
  const trimmed = authorization.trim();
  if (!BEARER_PREFIX.test(trimmed)) return null;
  const token = trimmed.replace(BEARER_PREFIX, "").trim();
  return token === "" ? null : token;
};

/** Authenticates a request and attaches `currentUser`. A bearer token takes precedence over the session cookie. */
@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(@Inject(Authenticator) private readonly authenticator: Authenticator) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = readBearer(request.headers.authorization);
    request.currentUser =
      bearer === null
        ? await this.authenticator.fromSessionCookie(request.headers.cookie)
        : await this.authenticator.fromBearer(bearer);
    return true;
  }
}
