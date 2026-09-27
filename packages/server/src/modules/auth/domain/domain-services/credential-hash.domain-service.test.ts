import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { CredentialHash } from "./credential-hash.domain-service.js";

describe("CredentialHash", () => {
  it("is a deterministic sha256 hex digest", () => {
    deepStrictEqual(
      CredentialHash.of("abc"),
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    deepStrictEqual(CredentialHash.of("abc"), CredentialHash.of("abc"));
    deepStrictEqual(CredentialHash.of("abc") === CredentialHash.of("abd"), false);
  });
});
