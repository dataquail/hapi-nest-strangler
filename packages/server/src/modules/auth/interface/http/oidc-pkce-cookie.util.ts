import { z } from "zod";

const PkcePayload = z.object({ state: z.string(), codeVerifier: z.string() });
export type PkcePayload = z.infer<typeof PkcePayload>;

export const PKCE_COOKIE_NAME = "oidc_pkce";

// Five minutes: the PKCE handshake window; the callback clears it on use.
export const PKCE_COOKIE_MAX_AGE_MS = 300_000;

export const encodePkcePayload = (payload: PkcePayload): string =>
  Buffer.from(JSON.stringify(payload)).toString("base64url");

export const decodePkcePayload = (encoded: string): PkcePayload | null => {
  try {
    const parsed = PkcePayload.safeParse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
