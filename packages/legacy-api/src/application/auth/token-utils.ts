import { createHash, createHmac, timingSafeEqual } from "crypto";

import config = require("../../../config");

const secret = (): string => config("/auth/sessionCookieSecret");

// Signs an opaque id into `id.signature` and verifies it back, in constant time.
export const signCookie = (id: string): string => {
  const signature = createHmac("sha256", secret()).update(id).digest("base64url");
  return `${id}.${signature}`;
};

export const verifyCookie = (raw: string): string | null => {
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const expected = createHmac("sha256", secret()).update(id).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? id : null;
};

export const hashCredential = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

export const PKCE_COOKIE_NAME = "oidc_pkce";

export type PkcePayload = { state: string; codeVerifier: string };

export const encodePkcePayload = (payload: PkcePayload): string =>
  Buffer.from(JSON.stringify(payload)).toString("base64url");

export const decodePkcePayload = (encoded: string): PkcePayload | null => {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (typeof parsed?.state === "string" && typeof parsed?.codeVerifier === "string") {
      return { state: parsed.state, codeVerifier: parsed.codeVerifier };
    }
    return null;
  } catch {
    return null;
  }
};

export const API_TOKEN_PREFIX = "pat";

export const assembleToken = (publicId: string, secretPart: string): string =>
  `${API_TOKEN_PREFIX}_${publicId}_${secretPart}`;

export const displayPrefix = (publicId: string): string => `${API_TOKEN_PREFIX}_${publicId}`;

// No 0/O/1/I: the code is typed by a human off another screen.
export const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const toUserCode = (bytes: Uint8Array): string => {
  const n = USER_CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let chars = "";
  for (let i = 0; i < bytes.length && chars.length < 8; i += 1) {
    const byte = bytes[i] ?? 0;
    if (byte >= limit) continue;
    chars += USER_CODE_ALPHABET[byte % n];
  }
  if (chars.length < 8) {
    throw new Error("toUserCode: not enough random bytes to build a user code");
  }
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
};

export const readBearer = (authorization: string | undefined): string | null => {
  if (!authorization) return null;
  const trimmed = authorization.trim();
  if (!/^Bearer\s+/i.test(trimmed)) return null;
  const token = trimmed.replace(/^Bearer\s+/i, "").trim();
  return token === "" ? null : token;
};
