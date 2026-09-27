import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { decodePkcePayload, encodePkcePayload } from "./oidc-pkce-cookie.util.js";

const asCookie = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");

describe("oidc-pkce-cookie codec", () => {
  it("round-trips a payload", () => {
    const payload = { state: "st-123", codeVerifier: "cv-abc-XYZ_0" };
    deepStrictEqual(decodePkcePayload(encodePkcePayload(payload)), payload);
  });

  it("returns null for non-JSON, missing fields, wrong types and primitives", () => {
    deepStrictEqual(decodePkcePayload("not valid base64url !!!"), null);
    deepStrictEqual(decodePkcePayload(asCookie({ state: "only-state" })), null);
    deepStrictEqual(decodePkcePayload(asCookie({ state: "s", codeVerifier: 42 })), null);
    deepStrictEqual(decodePkcePayload(asCookie("just a string")), null);
  });
});
