import { deepStrictEqual, throws } from "node:assert";

import { describe, it } from "vitest";

import {
  assembleToken,
  decodePkcePayload,
  displayPrefix,
  encodePkcePayload,
  readBearer,
  signCookie,
  toUserCode,
  verifyCookie,
} from "./token-utils";

describe("token-utils", () => {
  it("signs a cookie value that verifies back to the id and rejects tampering", () => {
    const signed = signCookie("abc-123");
    deepStrictEqual(verifyCookie(signed), "abc-123");
    deepStrictEqual(verifyCookie(`${signed}x`), null);
    deepStrictEqual(verifyCookie("nodot"), null);
    deepStrictEqual(verifyCookie("other-id." + signed.split(".")[1]), null);
  });

  it("round-trips the PKCE payload and refuses garbage", () => {
    const encoded = encodePkcePayload({ state: "s", codeVerifier: "v" });
    deepStrictEqual(decodePkcePayload(encoded), { state: "s", codeVerifier: "v" });
    deepStrictEqual(decodePkcePayload("%%%"), null);
    deepStrictEqual(decodePkcePayload(Buffer.from("{}").toString("base64url")), null);
    deepStrictEqual(decodePkcePayload(Buffer.from('{"state":"s"}').toString("base64url")), null);
  });

  it("assembles tokens under the pat prefix", () => {
    deepStrictEqual(assembleToken("abcd", "secret"), "pat_abcd_secret");
    deepStrictEqual(displayPrefix("abcd"), "pat_abcd");
  });

  it("builds an 8 character user code with a dash and no ambiguous glyphs", () => {
    const code = toUserCode(new Uint8Array(32).map((_, i) => i * 7));
    deepStrictEqual(
      /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/.test(code),
      true,
    );
    throws(() => toUserCode(new Uint8Array(2)));
  });

  it("reads a bearer token off the header and nothing else", () => {
    deepStrictEqual(readBearer("Bearer abc"), "abc");
    deepStrictEqual(readBearer("bearer   abc "), "abc");
    deepStrictEqual(readBearer("Basic abc"), null);
    deepStrictEqual(readBearer("Bearer "), null);
    deepStrictEqual(readBearer(undefined), null);
  });
});
