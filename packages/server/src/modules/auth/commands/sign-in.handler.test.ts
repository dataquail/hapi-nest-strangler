import { deepStrictEqual } from "node:assert";

import { PassThroughUnitOfWork } from "@org/unit-of-work/testing";
import { describe, it } from "vitest";

import { UserId } from "@/platform/ids/user-id.js";

import { AuthIdentitySpecifications } from "../domain/auth-identity/auth-identity.specification.js";
import { SessionSpecifications } from "../domain/session/session.specification.js";
import { UserProvisioningFake } from "../infrastructure/acl/user-provisioning.acl-fake.js";
import { AuthIdentityRepositoryFake } from "../infrastructure/repositories/auth-identity.repository-fake.js";
import { SessionRepositoryFake } from "../infrastructure/repositories/session.repository-fake.js";
import { SignInCommand } from "./sign-in.command.js";
import { SignInHandler } from "./sign-in.handler.js";

const knownUser = UserId.parse("11111111-1111-1111-1111-111111111111");
const ttl = { ttlSeconds: 60, absoluteTtlSeconds: 600 };

const setup = () => {
  const identities = new AuthIdentityRepositoryFake();
  const sessions = new SessionRepositoryFake();
  const provisioning = new UserProvisioningFake();
  const handler = new SignInHandler(identities, sessions, provisioning, PassThroughUnitOfWork);
  return { identities, sessions, provisioning, handler };
};

describe("SignInHandler", () => {
  it("creates a session for a known subject without provisioning", async () => {
    const { handler, identities, provisioning, sessions } = setup();
    await identities.insertOne({ subject: "sub-1", userId: knownUser, provider: "zitadel" });
    const result = await handler.execute(
      new SignInCommand({ subject: "sub-1", email: "a@x.io", ...ttl }),
    );
    deepStrictEqual(result.unwrap().userId, knownUser);
    deepStrictEqual(provisioning.provisioned.size, 0);
    const stored = (
      await sessions.findOne(SessionSpecifications.withId(result.unwrap().sessionId))
    ).unwrap();
    deepStrictEqual(stored?.subject, "sub-1");
  });

  it("provisions an unknown subject and links the identity", async () => {
    const { handler, identities, provisioning } = setup();
    const result = await handler.execute(
      new SignInCommand({ subject: "sub-new", email: "new@x.io", ...ttl }),
    );
    deepStrictEqual(result.unwrap().userId, provisioning.provisioned.get("new@x.io"));
    const linked = (
      await identities.findOne(AuthIdentitySpecifications.bySubject("sub-new"))
    ).unwrap();
    deepStrictEqual(linked?.userId, result.unwrap().userId);
  });

  it("refuses an unknown subject with no email", async () => {
    const { handler } = setup();
    const result = await handler.execute(
      new SignInCommand({ subject: "sub-new", email: null, ...ttl }),
    );
    deepStrictEqual(result.unwrapErr()._tag, "IdentityMissingEmail");
  });

  it("translates a provisioning conflict into IdentityEmailAlreadyRegistered", async () => {
    const { handler, provisioning } = setup();
    await provisioning.provision("taken@x.io");
    const result = await handler.execute(
      new SignInCommand({ subject: "sub-new", email: "taken@x.io", ...ttl }),
    );
    deepStrictEqual(result.unwrapErr()._tag, "IdentityEmailAlreadyRegistered");
  });
});
