import { createHmac, timingSafeEqual } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import { EnvVars } from "@/common/env-vars.js";

// Signs an opaque id into `id.signature` and verifies it back, in constant
// time: the same scheme and secret as the legacy API, which issues the cookie.
@Injectable()
export class CookieCodec {
  private readonly secret: string;

  constructor(@Inject(EnvVars) env: EnvVars) {
    this.secret = env.SESSION_COOKIE_SECRET;
  }

  public sign(id: string): string {
    const signature = createHmac("sha256", this.secret).update(id).digest("base64url");
    return `${id}.${signature}`;
  }

  public verify(raw: string): string | null {
    const dot = raw.lastIndexOf(".");
    if (dot <= 0) return null;
    const id = raw.slice(0, dot);
    const signature = raw.slice(dot + 1);
    const expected = createHmac("sha256", this.secret).update(id).digest("base64url");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return null;
    return timingSafeEqual(a, b) ? id : null;
  }
}
