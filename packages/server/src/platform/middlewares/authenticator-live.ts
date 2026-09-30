import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { CurrentUser } from "@org/contracts/Policy";
import { RowSchemas, sql } from "@org/database";
import { parseCookie } from "cookie";
import { z } from "zod";

import { EnvVars } from "@/common/env-vars.js";
import { Authenticator } from "@/platform/auth/authenticator.js";
import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import { Database } from "@/platform/database/database.js";
import { type HttpProblem, problem } from "@/platform/http/http-problem.js";
import { UserId } from "@/platform/ids/user-id.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

// "The store is down" is a 503 to retry; "your credential is bad" is a 401 to
// re-authenticate. Collapsing the former into the latter sends clients into a
// re-auth loop instead of a backoff.
const storeUnavailable = (): HttpProblem =>
  problem(HttpErrors.ServiceUnavailable, { message: "Auth store is unavailable" });
const rejectCredential = (): HttpProblem => problem(HttpErrors.Unauthorized, {});

const hashCredential = (raw: string): string => createHash("sha256").update(raw).digest("hex");

const secondsSince = (earlier: Date, now: Date): number =>
  (now.getTime() - earlier.getTime()) / 1000;

const earliest = (a: Date, b: Date): Date => (a.getTime() < b.getTime() ? a : b);

const SessionIdShape = z.guid();

const isLiveApiToken = (token: RowSchemas.LegacyApiTokenRow, now: Date): boolean =>
  token.revoked_at === null &&
  (token.expires_at === null || token.expires_at.getTime() > now.getTime());

const isLiveSession = (session: RowSchemas.LegacySessionRow, now: Date): boolean =>
  session.revoked_at === null &&
  session.expires_at.getTime() > now.getTime() &&
  session.absolute_expires_at.getTime() > now.getTime();

/**
 * The legacy API signs in, signs out and issues API tokens; this server only
 * reads the rows it wrote, from the shared database, and slides a session's
 * expiry the same way it does, so a session kept alive on either server stays
 * alive on both. Goes with the auth module when it moves.
 */
@Injectable()
export class AuthenticatorLive extends Authenticator {
  constructor(
    @Inject(EnvVars) private readonly env: EnvVars,
    @Inject(CookieCodec) private readonly codec: CookieCodec,
    @Inject(Database) private readonly db: Database,
  ) {
    super();
  }

  public async fromBearer(token: string): Promise<CurrentUser> {
    const tokenHash = hashCredential(token);
    const found = await translateDatabaseErrors(() =>
      this.db.maybeOne(sql.type(RowSchemas.LegacyApiTokenRow)`
        SELECT id, user_id, expires_at, revoked_at, last_used_at
        FROM public.api_tokens
        WHERE token_hash = ${tokenHash}
      `),
    );
    if (found.isErr()) throw storeUnavailable();
    const apiToken = found.unwrap();
    const now = new Date();
    if (apiToken === null || !isLiveApiToken(apiToken, now)) throw rejectCredential();
    if (secondsSince(apiToken.last_used_at, now) >= this.env.API_TOKEN_TOUCH_THRESHOLD_SECONDS) {
      await this.touch(sql.unsafe`
        UPDATE public.api_tokens SET last_used_at = ${sql.timestamp(now)}
        WHERE id = ${apiToken.id} AND revoked_at IS NULL
      `);
    }
    return { sessionId: apiToken.id, userId: UserId.parse(apiToken.user_id) };
  }

  public async fromSessionCookie(cookieHeader: string | undefined): Promise<CurrentUser> {
    const raw = parseCookie(cookieHeader ?? "")[this.env.SESSION_COOKIE_NAME];
    if (raw === undefined || raw === "") throw rejectCredential();
    const sessionId = SessionIdShape.safeParse(this.codec.verify(raw));
    if (!sessionId.success) throw rejectCredential();
    const found = await translateDatabaseErrors(() =>
      this.db.maybeOne(sql.type(RowSchemas.LegacySessionRow)`
        SELECT id, user_id, expires_at, absolute_expires_at, revoked_at, last_used_at
        FROM public.sessions
        WHERE id = ${sessionId.data}
      `),
    );
    if (found.isErr()) throw storeUnavailable();
    const session = found.unwrap();
    const now = new Date();
    if (session === null || !isLiveSession(session, now)) throw rejectCredential();
    if (secondsSince(session.last_used_at, now) >= this.env.SESSION_TOUCH_THRESHOLD_SECONDS) {
      const slid = new Date(now.getTime() + this.env.SESSION_TTL_SECONDS * 1000);
      await this.touch(sql.unsafe`
        UPDATE public.sessions
        SET expires_at = ${sql.timestamp(earliest(slid, session.absolute_expires_at))},
            last_used_at = ${sql.timestamp(now)}
        WHERE id = ${session.id} AND revoked_at IS NULL
      `);
    }
    return { sessionId: session.id, userId: UserId.parse(session.user_id) };
  }

  // A touch that fails is not a failed authentication: the caller was already
  // admitted, and the next request slides the expiry instead.
  private async touch(statement: Parameters<Database["exec"]>[0]): Promise<void> {
    await translateDatabaseErrors(() => this.db.exec(statement));
  }
}
