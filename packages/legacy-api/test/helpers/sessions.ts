import { randomUUID } from "node:crypto";

import { signCookie } from "../../src/application/auth/token-utils";
import config = require("../../config");
import { getKnex } from "./db";

const cookieName: string = config("/auth/sessionCookieName");

export const createUser = async (email: string, options: { superAdmin?: boolean } = {}) => {
  const id = randomUUID();
  await getKnex()("users").insert({ id, email });
  if (options.superAdmin) await getKnex()("roles").insert({ user_id: id, role: "super_admin" });
  return id;
};

export const createSession = async (
  userId: string,
  overrides: Partial<{ expires_at: Date; absolute_expires_at: Date; revoked_at: Date | null }> = {},
) => {
  const id = randomUUID();
  const now = new Date();
  await getKnex()("sessions").insert({
    id,
    user_id: userId,
    subject: `sub-${userId}`,
    expires_at: new Date(now.getTime() + 3600_000),
    absolute_expires_at: new Date(now.getTime() + 43200_000),
    revoked_at: null,
    ...overrides,
  });
  return id;
};

export const cookieFor = (sessionId: string) => `${cookieName}=${signCookie(sessionId)}`;

export const signedInAs = async (email: string, options: { superAdmin?: boolean } = {}) => {
  const userId = await createUser(email, options);
  const sessionId = await createSession(userId);
  return { userId, sessionId, headers: { cookie: cookieFor(sessionId) } };
};
