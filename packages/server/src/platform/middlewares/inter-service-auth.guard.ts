import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { Request } from "express";
import { jwtVerify } from "jose";

import { EnvVars } from "@/common/env-vars.js";
import { problem } from "@/platform/http/http-problem.js";

const BEARER_PREFIX = /^Bearer\s+/i;

const readBearer = (authorization: string | undefined): string | null => {
  if (authorization === undefined) return null;
  const trimmed = authorization.trim();
  if (!BEARER_PREFIX.test(trimmed)) return null;
  const token = trimmed.replace(BEARER_PREFIX, "").trim();
  return token === "" ? null : token;
};

/** Admits a machine caller presenting the shared-secret HS256 token; no user is attached to the request. */
@Injectable()
export class InterServiceAuthGuard implements CanActivate {
  private readonly secret: Uint8Array;

  constructor(@Inject(EnvVars) env: EnvVars) {
    this.secret = new TextEncoder().encode(env.INTER_SERVICE_JWT_SECRET);
  }

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = readBearer(request.headers.authorization);
    if (token === null) throw problem(HttpErrors.Unauthorized, {});
    try {
      await jwtVerify(token, this.secret, { algorithms: ["HS256"] });
    } catch {
      throw problem(HttpErrors.Unauthorized, {});
    }
    return true;
  }
}
