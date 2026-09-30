import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { type EnvVars } from "@/common/env-vars.js";

import { CookieCodec } from "./cookie-codec.js";

const codec = new CookieCodec({ SESSION_COOKIE_SECRET: "s3cret" } as EnvVars);

describe("CookieCodec", () => {
  it("round-trips a signed id", () => {
    deepStrictEqual(codec.verify(codec.sign("abc")), "abc");
  });

  it("rejects a tampered id, a tampered signature and a bare value", () => {
    const signed = codec.sign("abc");
    deepStrictEqual(codec.verify(signed.replace("abc", "abd")), null);
    deepStrictEqual(codec.verify(`${signed}x`), null);
    deepStrictEqual(codec.verify("abc"), null);
  });

  it("rejects a signature minted with another secret", () => {
    const other = new CookieCodec({ SESSION_COOKIE_SECRET: "other" } as EnvVars);
    deepStrictEqual(codec.verify(other.sign("abc")), null);
  });
});
