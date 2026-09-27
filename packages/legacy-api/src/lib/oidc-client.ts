import { createHash, randomBytes } from "crypto";
import type { JWTVerifyGetKey } from "jose" with { "resolution-mode": "import" };

import config = require("../../config");
import { problem } from "./problem";

type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
};

type AuthorizeRequest = { url: URL; state: string; codeVerifier: string };
type CodeExchangeResult = { subject: string; email: string | null };

type ZitadelConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
};

const base64url = (bytes: Buffer) => bytes.toString("base64url");

// jose ships ESM only; a CommonJS module reaches it through a dynamic import.
const loadJose = () => import("jose");

// The one place that knows the identity provider: discovery, the PKCE
// authorize URL, the code exchange with basic client authentication, id_token
// verification against the provider's JWKS, and end-session.
class OidcClient {
  private discovery: Discovery | null = null;
  private jwks: JWTVerifyGetKey | null = null;

  private get settings(): ZitadelConfig {
    return config("/auth/zitadel");
  }

  public async buildAuthorize(): Promise<AuthorizeRequest> {
    const discovery = await this.discover();
    const codeVerifier = base64url(randomBytes(32));
    const codeChallenge = base64url(createHash("sha256").update(codeVerifier).digest());
    const state = base64url(randomBytes(16));
    const url = new URL(discovery.authorization_endpoint);
    url.searchParams.set("client_id", this.settings.clientId);
    url.searchParams.set("redirect_uri", this.settings.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile offline_access");
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "login");
    return { url, state, codeVerifier };
  }

  public async exchangeCode(
    callbackUrl: URL,
    expectedState: string,
    codeVerifier: string,
  ): Promise<CodeExchangeResult> {
    const error = callbackUrl.searchParams.get("error");
    if (error) {
      throw problem(401, "Unauthorized", {
        message:
          `OIDC code exchange failed: ${error} ${callbackUrl.searchParams.get("error_description") ?? ""}`.trim(),
      });
    }
    const code = callbackUrl.searchParams.get("code");
    const state = callbackUrl.searchParams.get("state");
    if (!code || state !== expectedState) {
      throw problem(401, "Unauthorized", { message: "OIDC code exchange failed: state mismatch" });
    }
    const discovery = await this.discover();
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.settings.redirectUri,
      code_verifier: codeVerifier,
    });
    const basic = Buffer.from(
      `${encodeURIComponent(this.settings.clientId)}:${encodeURIComponent(this.settings.clientSecret)}`,
    ).toString("base64");
    const response = await fetch(discovery.token_endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${basic}`,
      },
      body,
    });
    if (!response.ok) {
      throw problem(401, "Unauthorized", {
        message: `OIDC code exchange failed: token endpoint answered ${response.status}`,
      });
    }
    const tokens = (await response.json()) as { id_token?: string; access_token?: string };
    if (!tokens.id_token) {
      throw problem(401, "Unauthorized", { message: "OIDC code exchange failed: no id_token" });
    }
    const jose = await loadJose();
    const { payload } = await jose.jwtVerify(tokens.id_token, await this.jwkSet(discovery), {
      issuer: discovery.issuer,
      audience: this.settings.clientId,
    });
    if (typeof payload.sub !== "string") {
      throw problem(401, "Unauthorized", { message: "id_token missing subject" });
    }
    let email = typeof payload.email === "string" ? payload.email : null;
    if (email === null && discovery.userinfo_endpoint && tokens.access_token) {
      email = await this.fetchEmail(discovery.userinfo_endpoint, tokens.access_token);
    }
    return { subject: payload.sub, email };
  }

  public async buildEndSessionUrl(): Promise<URL | null> {
    try {
      const discovery = await this.discover();
      if (!discovery.end_session_endpoint) return null;
      const url = new URL(discovery.end_session_endpoint);
      url.searchParams.set("client_id", this.settings.clientId);
      url.searchParams.set("post_logout_redirect_uri", this.settings.postLogoutRedirectUri);
      return url;
    } catch {
      return null;
    }
  }

  private async fetchEmail(userinfoEndpoint: string, accessToken: string): Promise<string | null> {
    try {
      const response = await fetch(userinfoEndpoint, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) return null;
      const info = (await response.json()) as { email?: unknown };
      return typeof info.email === "string" ? info.email : null;
    } catch {
      return null;
    }
  }

  private async jwkSet(discovery: Discovery): Promise<JWTVerifyGetKey> {
    const jose = await loadJose();
    this.jwks ??= jose.createRemoteJWKSet(new URL(discovery.jwks_uri));
    return this.jwks;
  }

  private async discover(): Promise<Discovery> {
    if (this.discovery) return this.discovery;
    const issuer = this.settings.issuer.replace(/\/$/, "");
    const response = await fetch(`${issuer}/.well-known/openid-configuration`);
    if (!response.ok) {
      throw problem(503, "ServiceUnavailable", {
        message: `OIDC discovery failed: ${response.status}`,
      });
    }
    this.discovery = (await response.json()) as Discovery;
    return this.discovery;
  }
}

OidcClient["@singleton"] = true;

export = OidcClient;
