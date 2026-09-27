import { Controller, Inject, Req, Res } from "@nestjs/common";
import { AuthContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";
import * as cookie from "cookie";
import type { Request, Response } from "express";

import { EnvVars } from "@/common/env-vars.js";
import { SignInCommand } from "@/modules/auth/commands/sign-in.command.js";
import { OidcClient } from "@/modules/auth/infrastructure/clients/oidc.client.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow } from "@/platform/http/endpoint.js";
import { type HttpProblem, problem } from "@/platform/http/http-problem.js";

import { buildCallbackUrl } from "./callback-url.util.js";
import { decodePkcePayload, PKCE_COOKIE_NAME, type PkcePayload } from "./oidc-pkce-cookie.util.js";

const route = AuthContract.PublicGroup.routes.callback;

const unauthorized = (message: string): HttpProblem =>
  problem(HttpErrors.Unauthorized, { message });

// Both provisioning failures get one opaque message: distinguishing them
// would tell whoever controls the IdP account whether an email is registered.
const cannotProvision = (): HttpProblem =>
  unauthorized("Cannot provision a user for this identity.");

@Controller()
export class CallbackEndpoint {
  constructor(
    @Inject(OidcClient) private readonly oidc: OidcClient,
    @Inject(CookieCodec) private readonly codec: CookieCodec,
    @Inject(EnvVars) private readonly env: EnvVars,
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
  ) {}

  @Endpoint(route)
  public async callback(@Req() request: Request, @Res() response: Response): Promise<void> {
    const pkce = this.readPkceCookie(request);
    const exchange = unwrapOrThrow(
      await this.oidc.exchangeCode(
        buildCallbackUrl(this.env.ZITADEL_REDIRECT_URI, request.url),
        pkce.state,
        pkce.codeVerifier,
      ),
      { OidcExchangeFailed: (error) => unauthorized(error.message) },
    );
    const { sessionId } = unwrapOrThrow(
      await this.commandBus.execute(
        new SignInCommand({
          subject: exchange.subject,
          email: exchange.email,
          ttlSeconds: this.env.SESSION_TTL_SECONDS,
          absoluteTtlSeconds: this.env.SESSION_ABSOLUTE_TTL_SECONDS,
        }),
      ),
      {
        IdentityMissingEmail: cannotProvision,
        IdentityEmailAlreadyRegistered: cannotProvision,
        PersistenceUnavailable: serviceUnavailable,
      },
    );
    response.cookie(this.env.SESSION_COOKIE_NAME, this.codec.sign(sessionId), {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: this.env.SESSION_TTL_SECONDS * 1000,
      path: "/",
    });
    response.clearCookie(PKCE_COOKIE_NAME, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
    response.redirect(route.success.status, this.env.APP_URL);
  }

  private readPkceCookie(request: Request): PkcePayload {
    const signed = cookie.parse(request.headers.cookie ?? "")[PKCE_COOKIE_NAME];
    if (signed === undefined || signed === "") throw unauthorized("Missing OIDC state cookie");
    const verified = this.codec.verify(signed);
    if (verified === null) throw unauthorized("Invalid OIDC state cookie");
    const payload = decodePkcePayload(verified);
    if (payload === null) throw unauthorized("Malformed OIDC state cookie");
    return payload;
  }
}
