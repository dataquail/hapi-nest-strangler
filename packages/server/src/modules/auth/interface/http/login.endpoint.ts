import { Controller, Inject, Res } from "@nestjs/common";
import { AuthContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { Response } from "express";

import { OidcClient } from "@/modules/auth/infrastructure/clients/oidc.client.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { Endpoint, unwrapOrThrow } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";

import {
  encodePkcePayload,
  PKCE_COOKIE_MAX_AGE_MS,
  PKCE_COOKIE_NAME,
} from "./oidc-pkce-cookie.util.js";

const route = AuthContract.PublicGroup.routes.login;

@Controller()
export class LoginEndpoint {
  constructor(
    @Inject(OidcClient) private readonly oidc: OidcClient,
    @Inject(CookieCodec) private readonly codec: CookieCodec,
  ) {}

  // SameSite=Lax and path "/" so the cookie survives the IdP's cross-site
  // redirect and Next's /api rewrite on the way back.
  @Endpoint(route)
  public async login(@Res() response: Response): Promise<void> {
    const { codeVerifier, state, url } = unwrapOrThrow(await this.oidc.buildAuthorize(), {
      OidcUnavailable: (error) =>
        problem(HttpErrors.ServiceUnavailable, { message: error.message }),
    });
    response.cookie(PKCE_COOKIE_NAME, this.codec.sign(encodePkcePayload({ state, codeVerifier })), {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: PKCE_COOKIE_MAX_AGE_MS,
      path: "/",
    });
    response.redirect(route.success.status, url.toString());
  }
}
