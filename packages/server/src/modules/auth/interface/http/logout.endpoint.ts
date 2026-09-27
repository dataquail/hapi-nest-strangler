import { Controller, Inject, Req, Res } from "@nestjs/common";
import { AuthContract } from "@org/contracts/api/Contracts";
import * as cookie from "cookie";
import type { Request, Response } from "express";

import { EnvVars } from "@/common/env-vars.js";
import { RevokeSessionCommand } from "@/modules/auth/commands/revoke-session.command.js";
import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { OidcClient } from "@/modules/auth/infrastructure/clients/oidc.client.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint } from "@/platform/http/endpoint.js";

const route = AuthContract.PublicGroup.routes.logout;

// Reads the cookie inline rather than behind the guard: logout must work
// when the session is already gone. Ends with the IdP's end-session redirect
// so its SSO cookie is torn down too.
@Controller()
export class LogoutEndpoint {
  constructor(
    @Inject(EnvVars) private readonly env: EnvVars,
    @Inject(CookieCodec) private readonly codec: CookieCodec,
    @Inject(OidcClient) private readonly oidc: OidcClient,
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
  ) {}

  @Endpoint(route)
  public async logout(@Req() request: Request, @Res() response: Response): Promise<void> {
    const raw = cookie.parse(request.headers.cookie ?? "")[this.env.SESSION_COOKIE_NAME];
    const verified = raw === undefined || raw === "" ? null : this.codec.verify(raw);
    const sessionId = verified === null ? null : SessionId.safeParse(verified);
    if (sessionId?.success === true) {
      await this.commandBus.execute(new RevokeSessionCommand({ sessionId: sessionId.data }));
    }
    const endSession = await this.oidc.buildEndSessionUrl();
    const location = endSession.isOk() ? endSession.unwrap().toString() : this.env.APP_URL;
    response.clearCookie(this.env.SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      path: "/",
    });
    response.redirect(route.success.status, location);
  }
}
