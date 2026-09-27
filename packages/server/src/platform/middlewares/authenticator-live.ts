import { Inject, Injectable } from "@nestjs/common";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { CurrentUser } from "@org/contracts/Policy";
import * as cookie from "cookie";

import { EnvVars } from "@/common/env-vars.js";
import {
  CredentialHash,
  FindApiTokenByHashQuery,
  FindSessionQuery,
  SessionId,
  TouchApiTokenCommand,
  TouchSessionCommand,
} from "@/modules/auth/auth.platform.js";
import { Authenticator } from "@/platform/auth/authenticator.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { type HttpProblem, problem } from "@/platform/http/http-problem.js";

// "The store is down" is a 503 to retry; "your credential is bad" is a 401 to
// re-authenticate. Collapsing the former into the latter sends clients into a
// re-auth loop instead of a backoff.
const storeUnavailable = (): HttpProblem =>
  problem(HttpErrors.ServiceUnavailable, { message: "Auth store is unavailable" });
const rejectCredential = (): HttpProblem => problem(HttpErrors.Unauthorized, {});

// The touch stays off the auth critical path and outlives the response; the
// handlers are throttled and infallible, so nothing here can fail a request.
const fireAndForget = (work: Promise<unknown>): void => {
  void work.catch(() => undefined);
};

/** Both credential kinds resolve to one shape; a bearer caller's token id stands in as its opaque principal id. */
@Injectable()
export class AuthenticatorLive extends Authenticator {
  constructor(
    @Inject(EnvVars) private readonly env: EnvVars,
    @Inject(CookieCodec) private readonly codec: CookieCodec,
    @Inject(AppQueryBus) private readonly queryBus: AppQueryBus,
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
  ) {
    super();
  }

  public async fromBearer(token: string): Promise<CurrentUser> {
    // Hashed here so the raw secret never travels through the bus or a span.
    const found = await this.queryBus.execute(
      new FindApiTokenByHashQuery({ tokenHash: CredentialHash.of(token) }),
    );
    if (found.isErr()) {
      throw found.unwrapErr()._tag === "PersistenceUnavailable"
        ? storeUnavailable()
        : rejectCredential();
    }
    const apiToken = found.unwrap();
    fireAndForget(
      this.commandBus.execute(
        new TouchApiTokenCommand({
          apiTokenId: apiToken.id,
          thresholdSeconds: this.env.API_TOKEN_TOUCH_THRESHOLD_SECONDS,
        }),
      ),
    );
    return { sessionId: apiToken.id, userId: apiToken.userId };
  }

  public async fromSessionCookie(cookieHeader: string | undefined): Promise<CurrentUser> {
    const raw = cookie.parse(cookieHeader ?? "")[this.env.SESSION_COOKIE_NAME];
    if (raw === undefined || raw === "") throw rejectCredential();
    const verified = this.codec.verify(raw);
    const sessionId = verified === null ? null : SessionId.safeParse(verified);
    if (sessionId === null || !sessionId.success) throw rejectCredential();
    const found = await this.queryBus.execute(new FindSessionQuery({ sessionId: sessionId.data }));
    if (found.isErr()) {
      throw found.unwrapErr()._tag === "PersistenceUnavailable"
        ? storeUnavailable()
        : rejectCredential();
    }
    const session = found.unwrap();
    fireAndForget(
      this.commandBus.execute(
        new TouchSessionCommand({
          sessionId: session.id,
          ttlSeconds: this.env.SESSION_TTL_SECONDS,
          thresholdSeconds: this.env.SESSION_TOUCH_THRESHOLD_SECONDS,
        }),
      ),
    );
    return { sessionId: session.id, userId: session.userId };
  }
}
