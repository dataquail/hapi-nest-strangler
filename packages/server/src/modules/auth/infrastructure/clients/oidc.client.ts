import { Inject, Injectable } from "@nestjs/common";
import * as openid from "openid-client";
import { Err, Ok, type Result } from "oxide.ts";

import { EnvVars } from "@/common/env-vars.js";
import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";

export class OidcUnavailable extends TaggedError("OidcUnavailable")<{ readonly message: string }> {}
export class OidcExchangeFailed extends TaggedError("OidcExchangeFailed")<{
  readonly message: string;
}> {}

export type AuthorizeRequest = {
  readonly url: URL;
  readonly state: string;
  readonly codeVerifier: string;
};

export type CodeExchangeResult = {
  readonly subject: string;
  readonly email: string | null;
};

const isString = (value: unknown): value is string => typeof value === "string";

const readEmail = (source: unknown): string | null =>
  typeof source === "object" && source !== null && "email" in source && isString(source.email)
    ? source.email
    : null;

/** The one place that knows Zitadel: discovery, PKCE authorize, code exchange, end-session. */
@Injectable()
export class OidcClient {
  private cached: openid.Configuration | null = null;

  constructor(@Inject(EnvVars) private readonly env: EnvVars) {}

  public async buildAuthorize(): Promise<Result<AuthorizeRequest, OidcUnavailable>> {
    try {
      const config = await this.configuration();
      const codeVerifier = openid.randomPKCECodeVerifier();
      const codeChallenge = await openid.calculatePKCECodeChallenge(codeVerifier);
      const state = openid.randomState();
      const url = openid.buildAuthorizationUrl(config, {
        redirect_uri: this.env.ZITADEL_REDIRECT_URI,
        scope: "openid email profile offline_access",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state,
        prompt: "login",
      });
      return Ok({ url, state, codeVerifier });
    } catch (cause) {
      return Err(
        new OidcUnavailable({ message: `Failed to build authorize URL: ${String(cause)}` }),
      );
    }
  }

  public async exchangeCode(
    callbackUrl: URL,
    expectedState: string,
    codeVerifier: string,
  ): Promise<Result<CodeExchangeResult, OidcExchangeFailed>> {
    try {
      const config = await this.configuration();
      const tokens = await openid.authorizationCodeGrant(config, callbackUrl, {
        expectedState,
        pkceCodeVerifier: codeVerifier,
      });
      const claims = tokens.claims();
      if (claims === undefined || !isString(claims.sub)) {
        return Err(new OidcExchangeFailed({ message: "id_token missing subject" }));
      }
      let email = readEmail(claims);
      if (email === null) {
        try {
          email = readEmail(await openid.fetchUserInfo(config, tokens.access_token, claims.sub));
        } catch {
          email = null;
        }
      }
      return Ok({ subject: claims.sub, email });
    } catch (cause) {
      return Err(
        new OidcExchangeFailed({ message: `OIDC code exchange failed: ${String(cause)}` }),
      );
    }
  }

  public async buildEndSessionUrl(): Promise<Result<URL, OidcUnavailable>> {
    try {
      const config = await this.configuration();
      return Ok(
        openid.buildEndSessionUrl(config, {
          post_logout_redirect_uri: this.env.ZITADEL_POST_LOGOUT_REDIRECT_URI,
        }),
      );
    } catch (cause) {
      return Err(
        new OidcUnavailable({ message: `Failed to build end session URL: ${String(cause)}` }),
      );
    }
  }

  private async configuration(): Promise<openid.Configuration> {
    if (this.cached !== null) return this.cached;
    const issuerUrl = new URL(this.env.ZITADEL_ISSUER);
    const allowHttp = issuerUrl.protocol === "http:";
    this.cached = await openid.discovery(
      issuerUrl,
      this.env.ZITADEL_CLIENT_ID,
      this.env.ZITADEL_CLIENT_SECRET,
      undefined,
      allowHttp ? { execute: [openid.allowInsecureRequests] } : undefined,
    );
    return this.cached;
  }
}
