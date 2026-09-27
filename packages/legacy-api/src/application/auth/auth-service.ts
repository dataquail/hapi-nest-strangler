import type Bookshelf from "bookshelf";
import { randomBytes, randomUUID } from "crypto";
import type { Knex } from "knex";

import config = require("../../../config");
import * as logger from "../../lib/logger";
import { problem } from "../../lib/problem";
import type UserService = require("../user/user-service");
import { assembleToken, displayPrefix, hashCredential, toUserCode } from "./token-utils";

const DAY_MS = 86_400_000;

type AuthConfig = {
  sessionTtlSeconds: number;
  sessionAbsoluteTtlSeconds: number;
  sessionTouchThresholdSeconds: number;
  apiTokenDefaultTtlDays: number;
  apiTokenTouchThresholdSeconds: number;
  deviceCodeTtlSeconds: number;
  devicePollIntervalSeconds: number;
};

type SessionRow = {
  id: string;
  user_id: string;
  subject: string;
  expires_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
  created_at: Date;
  last_used_at: Date;
};

type ApiTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  prefix: string;
  label: string;
  expires_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
  last_used_at: Date;
};

type DeviceGrantRow = {
  id: string;
  device_code_hash: string;
  user_code: string;
  status: "pending" | "approved";
  user_id: string | null;
  created_at: Date;
  expires_at: Date;
  approved_at: Date | null;
};

const addSeconds = (date: Date, seconds: number) => new Date(date.getTime() + seconds * 1000);

// Both provisioning failures get one opaque message: distinguishing them
// would tell whoever controls the IdP account whether an email is registered.
const cannotProvision = () =>
  problem(401, "Unauthorized", { message: "Cannot provision a user for this identity." });

class AuthService {
  public bookshelf: Bookshelf;
  public userService: UserService;

  constructor(bookshelf: Bookshelf, userService: UserService) {
    this.bookshelf = bookshelf;
    this.userService = userService;
  }

  // @types/bookshelf is typed against knex 0.21; the instance is knex 2.
  get knex(): Knex {
    return this.bookshelf.knex as unknown as Knex;
  }

  get settings(): AuthConfig {
    return config("/auth");
  }

  // Provisioning, identity link and session insert share one transaction, so a
  // failure anywhere rolls the whole sign-in back.
  async signIn(subject: string, email: string | null) {
    return this.knex.transaction(async (t) => {
      let userId: string;
      const identity = await this.knex("auth_identities").transacting(t).where({ subject }).first();
      if (identity) {
        userId = identity.user_id;
      } else {
        if (email === null) throw cannotProvision();
        try {
          userId = await this.userService.createUser({ email }, t);
        } catch (error: any) {
          if (error?.isBoom && error.output.statusCode === 409) throw cannotProvision();
          throw error;
        }
        await this.knex("auth_identities")
          .transacting(t)
          .insert({ subject, user_id: userId, provider: "zitadel", created_at: new Date() });
      }
      const now = new Date();
      const sessionId = randomUUID();
      await this.knex("sessions")
        .transacting(t)
        .insert({
          id: sessionId,
          user_id: userId,
          subject,
          expires_at: addSeconds(now, this.settings.sessionTtlSeconds),
          absolute_expires_at: addSeconds(now, this.settings.sessionAbsoluteTtlSeconds),
          revoked_at: null,
          created_at: now,
          last_used_at: now,
        });
      return { sessionId, userId };
    });
  }

  async findSession(sessionId: string): Promise<SessionRow | null> {
    const row: SessionRow | undefined = await this.knex("sessions")
      .where({ id: sessionId })
      .first();
    if (row?.revoked_at !== null) return null;
    const now = Date.now();
    if (row.expires_at.getTime() <= now || row.absolute_expires_at.getTime() <= now) return null;
    return row;
  }

  // Sliding expiry, capped by the absolute expiry set at sign-in; throttled so
  // a burst of requests writes once.
  async touchSession(session: SessionRow) {
    const now = new Date();
    const elapsedSeconds = (now.getTime() - session.last_used_at.getTime()) / 1000;
    if (elapsedSeconds < this.settings.sessionTouchThresholdSeconds) return;
    const candidate = addSeconds(now, this.settings.sessionTtlSeconds);
    const expiresAt =
      candidate.getTime() < session.absolute_expires_at.getTime()
        ? candidate
        : session.absolute_expires_at;
    await this.knex("sessions")
      .where({ id: session.id })
      .whereNull("revoked_at")
      .update({ expires_at: expiresAt, last_used_at: now });
  }

  async revokeSession(sessionId: string) {
    await this.knex("sessions")
      .where({ id: sessionId })
      .whereNull("revoked_at")
      .update({ revoked_at: new Date() });
  }

  // The plaintext token is returned exactly once; only its hash is persisted.
  async mintApiToken(
    input: { userId: string; label: string; expiresInDays: number },
    transacting?: Knex.Transaction,
  ) {
    const publicId = randomBytes(4).toString("hex");
    const secretPart = randomBytes(32).toString("base64url");
    const token = assembleToken(publicId, secretPart);
    const now = new Date();
    const apiToken: ApiTokenRow = {
      id: randomUUID(),
      user_id: input.userId,
      token_hash: hashCredential(token),
      prefix: displayPrefix(publicId),
      label: input.label,
      expires_at: new Date(now.getTime() + input.expiresInDays * DAY_MS),
      revoked_at: null,
      created_at: now,
      last_used_at: now,
    };
    const query = this.knex("api_tokens").insert(apiToken);
    await (transacting ? query.transacting(transacting) : query);
    return { apiToken, token };
  }

  async listMyApiTokens(userId: string): Promise<ApiTokenRow[]> {
    return this.knex("api_tokens")
      .where({ user_id: userId })
      .whereNull("revoked_at")
      .orderBy("created_at", "desc");
  }

  // Scoped to the owner: someone else's token is reported as not found, never revealed.
  async revokeApiToken(apiTokenId: string, userId: string) {
    const row: ApiTokenRow | undefined = await this.knex("api_tokens")
      .where({ id: apiTokenId })
      .first();
    if (!row || row.user_id !== userId) {
      throw problem(404, "NotFound", { message: "API token not found" });
    }
    const touched = await this.knex("api_tokens")
      .where({ id: apiTokenId })
      .whereNull("revoked_at")
      .update({ revoked_at: new Date() });
    if (touched === 0) throw problem(404, "NotFound", { message: "API token not found" });
  }

  async findApiTokenByHash(tokenHash: string): Promise<ApiTokenRow | null> {
    const row: ApiTokenRow | undefined = await this.knex("api_tokens")
      .where({ token_hash: tokenHash })
      .first();
    if (row?.revoked_at !== null) return null;
    if (row.expires_at !== null && row.expires_at.getTime() <= Date.now()) return null;
    return row;
  }

  async touchApiToken(token: ApiTokenRow) {
    const now = new Date();
    const elapsedSeconds = (now.getTime() - token.last_used_at.getTime()) / 1000;
    if (elapsedSeconds < this.settings.apiTokenTouchThresholdSeconds) return;
    await this.knex("api_tokens")
      .where({ id: token.id })
      .whereNull("revoked_at")
      .update({ last_used_at: now });
  }

  // The plaintext deviceCode is returned to the CLI once; only its hash is stored.
  async startDeviceGrant() {
    const deviceCode = randomBytes(32).toString("base64url");
    const userCode = toUserCode(randomBytes(16));
    const now = new Date();
    const expiresAt = addSeconds(now, this.settings.deviceCodeTtlSeconds);
    await this.knex("device_grants").insert({
      id: randomUUID(),
      device_code_hash: hashCredential(deviceCode),
      user_code: userCode,
      status: "pending",
      user_id: null,
      created_at: now,
      expires_at: expiresAt,
      approved_at: null,
    });
    return { deviceCode, userCode, expiresAt };
  }

  // Idempotent: re-approving an already approved grant re-stamps it.
  async approveDeviceGrant(userCode: string, userId: string) {
    const grant: DeviceGrantRow | undefined = await this.knex("device_grants")
      .where({ user_code: userCode })
      .first();
    if (!grant)
      throw problem(404, "NotFound", { message: "No pending device request for that code" });
    if (grant.expires_at.getTime() <= Date.now()) {
      throw problem(410, "Gone", { message: "That device code has expired" });
    }
    await this.knex("device_grants")
      .where({ id: grant.id })
      .update({ status: "approved", user_id: userId, approved_at: new Date() });
  }

  // Single-use exchange: the token is minted and the grant consumed in one
  // transaction, so a grant can never yield two tokens.
  async pollDeviceGrant(deviceCode: string) {
    const grant: DeviceGrantRow | undefined = await this.knex("device_grants")
      .where({ device_code_hash: hashCredential(deviceCode) })
      .first();
    if (!grant) throw problem(400, "DeviceCodeNotFound", { message: "invalid device code" });
    if (grant.expires_at.getTime() <= Date.now()) {
      await this.knex("device_grants").where({ id: grant.id }).del();
      throw problem(400, "DeviceTokenExpired", { message: "expired_token" });
    }
    if (grant.status === "pending" || grant.user_id === null) {
      throw problem(400, "DeviceAuthorizationPending", { message: "authorization_pending" });
    }
    const userId = grant.user_id;
    return this.knex.transaction(async (t) => {
      const minted = await this.mintApiToken(
        { userId, label: "cli", expiresInDays: this.settings.apiTokenDefaultTtlDays },
        t,
      );
      await this.knex("device_grants").transacting(t).where({ id: grant.id }).del();
      return minted;
    });
  }

  fireAndForget(work: Promise<unknown>) {
    work.catch((error) => {
      logger.error("auth background write failed", error);
    });
  }
}

AuthService["@singleton"] = true;
AuthService["@require"] = ["bookshelf", "user/user-service"];

export = AuthService;
