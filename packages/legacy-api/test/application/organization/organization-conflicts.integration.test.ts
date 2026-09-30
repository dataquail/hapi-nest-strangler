import { deepStrictEqual } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import config = require("../../../config");
import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { startFakeWalletServer } from "../../helpers/fake-wallet-server";
import { signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

type Session = Awaited<ReturnType<typeof signedInAs>>;

describe.sequential("organization conflicts (integration)", () => {
  let server: Awaited<ReturnType<typeof getServer>>;
  let wallets: Awaited<ReturnType<typeof startFakeWalletServer>>;

  beforeAll(async () => {
    wallets = await startFakeWalletServer(config("/auth/interServiceJWTSecret"));
    server = await getServer();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
    await wallets.stop();
    await closeKnex();
  });

  beforeEach(truncateAll);

  const body = (res: { payload: string }) => JSON.parse(res.payload);
  const createOrg = async (owner: Session) =>
    body(
      await server.inject({
        method: "POST",
        url: "/orgs",
        headers: owner.headers,
        payload: { name: "Acme" },
      }),
    ).id as string;
  const invite = async (owner: Session, orgId: string, email: string) => {
    await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/invitations`,
      headers: owner.headers,
      payload: { email },
    });
    return getKnex()("invitations")
      .where({ invitee_email: email })
      .orderBy("created_at", "desc")
      .first();
  };

  it("answers 404 for a second delete and 409 for restoring an organization that is live", async () => {
    const owner = await signedInAs("owner@example.com");
    const admin = await signedInAs("admin@example.com", { superAdmin: true });
    const orgId = await createOrg(owner);

    const live = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/restore`,
      headers: admin.headers,
    });
    deepStrictEqual(live.statusCode, 409);
    deepStrictEqual(body(live)._tag, "OrganizationNotDeletedError");

    deepStrictEqual(
      (await server.inject({ method: "DELETE", url: `/orgs/${orgId}`, headers: admin.headers }))
        .statusCode,
      204,
    );
    const twice = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}`,
      headers: admin.headers,
    });
    deepStrictEqual(twice.statusCode, 404);
  });

  it("reissues an open invitation for the same email, and refuses to revoke, resend or accept one that is gone", async () => {
    const owner = await signedInAs("owner@example.com");
    const invitee = await signedInAs("new@example.com");
    const orgId = await createOrg(owner);

    const first = await invite(owner, orgId, "new@example.com");
    const again = await invite(owner, orgId, "new@example.com");
    deepStrictEqual(again.id, first.id);
    deepStrictEqual((await getKnex()("invitations")).length, 1);

    const unknown = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/invitations/00000000-0000-0000-0000-000000000000`,
      headers: owner.headers,
    });
    deepStrictEqual(unknown.statusCode, 404);

    deepStrictEqual(
      (
        await server.inject({
          method: "DELETE",
          url: `/orgs/${orgId}/invitations/${first.id}`,
          headers: owner.headers,
        })
      ).statusCode,
      204,
    );
    const revokedTwice = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/invitations/${first.id}`,
      headers: owner.headers,
    });
    deepStrictEqual(revokedTwice.statusCode, 410);
    deepStrictEqual(body(revokedTwice).reason, "revoked");
    const resendRevoked = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/invitations/${first.id}/resend`,
      headers: owner.headers,
    });
    deepStrictEqual(body(resendRevoked).reason, "revoked");
    const acceptRevoked = await server.inject({
      method: "POST",
      url: `/invitations/${again.token}/accept`,
      headers: invitee.headers,
    });
    deepStrictEqual(acceptRevoked.statusCode, 410);
    deepStrictEqual(body(acceptRevoked).reason, "revoked");

    const fresh = await invite(owner, orgId, "new@example.com");
    deepStrictEqual(
      (
        await server.inject({
          method: "POST",
          url: `/invitations/${fresh.token}/accept`,
          headers: invitee.headers,
        })
      ).statusCode,
      200,
    );
    const revokeAccepted = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/invitations/${fresh.id}`,
      headers: owner.headers,
    });
    deepStrictEqual(body(revokeAccepted).reason, "accepted");
    const resendAccepted = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/invitations/${fresh.id}/resend`,
      headers: owner.headers,
    });
    deepStrictEqual(body(resendAccepted).reason, "accepted");
  });

  it("refuses membership changes that make no sense", async () => {
    const owner = await signedInAs("owner@example.com");
    const stranger = await signedInAs("stranger@example.com");
    const member = await signedInAs("member@example.com");
    const orgId = await createOrg(owner);
    await getKnex()("memberships").insert({ user_id: member.userId, organization_id: orgId });

    const removeStranger = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/members/${stranger.userId}`,
      headers: owner.headers,
    });
    deepStrictEqual(removeStranger.statusCode, 404);
    deepStrictEqual(body(removeStranger)._tag, "MembershipNotFoundError");

    const leaveAsStranger = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/leave`,
      headers: stranger.headers,
    });
    deepStrictEqual(leaveAsStranger.statusCode, 404);

    const promoteSelf = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/members/${owner.userId}/admin`,
      headers: owner.headers,
    });
    deepStrictEqual(promoteSelf.statusCode, 403);

    const demoteMember = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/members/${member.userId}/admin`,
      headers: owner.headers,
    });
    deepStrictEqual(demoteMember.statusCode, 409);
    deepStrictEqual(body(demoteMember).reason, "not_admin");

    deepStrictEqual(
      (
        await server.inject({
          method: "POST",
          url: `/orgs/${orgId}/members/${member.userId}/admin`,
          headers: owner.headers,
        })
      ).statusCode,
      204,
    );
    const promoteTwice = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/members/${member.userId}/admin`,
      headers: owner.headers,
    });
    deepStrictEqual(promoteTwice.statusCode, 409);
    deepStrictEqual(body(promoteTwice).reason, "already_admin");
  });
});
