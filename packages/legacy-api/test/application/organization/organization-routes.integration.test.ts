import { deepStrictEqual, ok } from "node:assert";

import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import config = require("../../../config");
import { closeKnex, getKnex, truncateAll } from "../../helpers/db";
import { startFakeWalletServer } from "../../helpers/fake-wallet-server";
import { signedInAs } from "../../helpers/sessions";
import { getServer } from "../../server";

type Session = Awaited<ReturnType<typeof signedInAs>>;

describe.sequential("organization routes (integration)", () => {
  let server: Awaited<ReturnType<typeof getServer>>;
  let wallets: Awaited<ReturnType<typeof startFakeWalletServer>>;
  const emailService = () =>
    (server.app as any).emailService as { sent: Array<{ to: string; html: string }> };

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

  beforeEach(async () => {
    await truncateAll();
    emailService().sent.length = 0;
  });

  const createOrg = async (owner: Session, name = "Acme") => {
    const res = await server.inject({
      method: "POST",
      url: "/orgs",
      headers: owner.headers,
      payload: { name },
    });
    deepStrictEqual(res.statusCode, 201, res.payload);
    return JSON.parse(res.payload).id as string;
  };

  const body = (res: { payload: string }) => JSON.parse(res.payload);

  it("creates an organization owned and administered by the caller, and lists it", async () => {
    const owner = await signedInAs("owner@example.com");
    const orgId = await createOrg(owner);
    const mine = body(await server.inject({ method: "GET", url: "/orgs", headers: owner.headers }));
    deepStrictEqual(mine.length, 1);
    deepStrictEqual(mine[0].id, orgId);
    deepStrictEqual(mine[0].isAdmin, true);
    deepStrictEqual(mine[0].deletedAt, null);
    const cli = body(
      await server.inject({ method: "GET", url: "/cli/orgs", headers: owner.headers }),
    );
    deepStrictEqual(cli, [{ id: orgId, name: "Acme", isAdmin: true }]);
  });

  it("refuses a super admin who tries to own an organization", async () => {
    const admin = await signedInAs("admin@example.com", { superAdmin: true });
    const res = await server.inject({
      method: "POST",
      url: "/orgs",
      headers: admin.headers,
      payload: { name: "Nope" },
    });
    deepStrictEqual(res.statusCode, 409);
    deepStrictEqual(body(res)._tag, "SuperAdminCannotOwnOrganizationError");
  });

  it("soft-deletes and restores for a super admin only, with the right conflicts", async () => {
    const owner = await signedInAs("owner@example.com");
    const admin = await signedInAs("admin@example.com", { superAdmin: true });
    const orgId = await createOrg(owner);

    const forbidden = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}`,
      headers: owner.headers,
    });
    deepStrictEqual(forbidden.statusCode, 403);

    const notDeleted = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/restore`,
      headers: admin.headers,
    });
    deepStrictEqual(notDeleted.statusCode, 409);
    deepStrictEqual(body(notDeleted)._tag, "OrganizationNotDeletedError");

    deepStrictEqual(
      (await server.inject({ method: "DELETE", url: `/orgs/${orgId}`, headers: admin.headers }))
        .statusCode,
      204,
    );
    deepStrictEqual(
      body(await server.inject({ method: "GET", url: "/orgs", headers: owner.headers })).length,
      0,
    );
    const again = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}`,
      headers: admin.headers,
    });
    deepStrictEqual(again.statusCode, 404);
    deepStrictEqual(body(again)._tag, "OrganizationNotFoundError");

    deepStrictEqual(
      (
        await server.inject({
          method: "POST",
          url: `/orgs/${orgId}/restore`,
          headers: admin.headers,
        })
      ).statusCode,
      204,
    );
    deepStrictEqual(
      body(await server.inject({ method: "GET", url: "/orgs", headers: owner.headers })).length,
      1,
    );

    const unknown = await server.inject({
      method: "DELETE",
      url: "/orgs/00000000-0000-0000-0000-000000000000",
      headers: admin.headers,
    });
    deepStrictEqual(unknown.statusCode, 404);
    deepStrictEqual(body(unknown).organizationId, "00000000-0000-0000-0000-000000000000");
  });

  it("lists every organization for a super admin, deleted ones on request", async () => {
    const owner = await signedInAs("owner@example.com");
    const admin = await signedInAs("admin@example.com", { superAdmin: true });
    const a = await createOrg(owner, "A");
    await createOrg(owner, "B");
    await server.inject({ method: "DELETE", url: `/orgs/${a}`, headers: admin.headers });
    const live = body(
      await server.inject({
        method: "GET",
        url: "/admin/orgs?page=1&pageSize=10",
        headers: admin.headers,
      }),
    );
    deepStrictEqual(live.total, 1);
    const all = body(
      await server.inject({
        method: "GET",
        url: "/admin/orgs?page=1&pageSize=10&includeDeleted=true",
        headers: admin.headers,
      }),
    );
    deepStrictEqual(all.total, 2);
    ok(all.organizations.some((o: any) => o.deletedAt !== null));
    const forbidden = await server.inject({
      method: "GET",
      url: "/admin/orgs?page=1&pageSize=10",
      headers: owner.headers,
    });
    deepStrictEqual(forbidden.statusCode, 403);
  });

  it("invites, lists, resends and revokes invitations, mailing the invitee each time", async () => {
    const owner = await signedInAs("owner@example.com");
    const orgId = await createOrg(owner);
    const invited = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/invitations`,
      headers: owner.headers,
      payload: { email: "new@example.com" },
    });
    deepStrictEqual(invited.statusCode, 201);
    const { invitationId } = body(invited);
    await new Promise((resolve) => setTimeout(resolve, 20));
    deepStrictEqual(emailService().sent.length, 1);
    deepStrictEqual(emailService().sent[0].to, "new@example.com");
    ok(emailService().sent[0].html.includes("http://app.test/invitations/"));

    // Reissued, not duplicated.
    const again = body(
      await server.inject({
        method: "POST",
        url: `/orgs/${orgId}/invitations`,
        headers: owner.headers,
        payload: { email: "new@example.com" },
      }),
    );
    deepStrictEqual(again.invitationId, invitationId);

    const listed = body(
      await server.inject({
        method: "GET",
        url: `/orgs/${orgId}/invitations`,
        headers: owner.headers,
      }),
    );
    deepStrictEqual(
      listed.invitations.map((i: any) => [i.inviteeEmail, i.status]),
      [["new@example.com", "pending"]],
    );

    const resent = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/invitations/${invitationId}/resend`,
      headers: owner.headers,
    });
    deepStrictEqual(resent.statusCode, 204);
    await new Promise((resolve) => setTimeout(resolve, 20));
    deepStrictEqual(emailService().sent.length, 3);

    const revoked = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/invitations/${invitationId}`,
      headers: owner.headers,
    });
    deepStrictEqual(revoked.statusCode, 204);
    const twice = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/invitations/${invitationId}`,
      headers: owner.headers,
    });
    deepStrictEqual(twice.statusCode, 410);
    deepStrictEqual(body(twice), {
      _tag: "InvitationGoneError",
      reason: "revoked",
      message: "Invitation already revoked.",
    });
    deepStrictEqual(
      body(
        await server.inject({
          method: "GET",
          url: `/orgs/${orgId}/invitations`,
          headers: owner.headers,
        }),
      ).invitations,
      [],
    );
  });

  it("accepts an invitation by token, then refuses it again", async () => {
    const owner = await signedInAs("owner@example.com");
    const invitee = await signedInAs("new@example.com");
    const orgId = await createOrg(owner);
    await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/invitations`,
      headers: owner.headers,
      payload: { email: "new@example.com" },
    });
    const { token } = await getKnex()("invitations").first();

    const accepted = await server.inject({
      method: "POST",
      url: `/invitations/${token}/accept`,
      headers: invitee.headers,
    });
    deepStrictEqual(accepted.statusCode, 200);
    deepStrictEqual(body(accepted), { organizationId: orgId });
    const mine = body(
      await server.inject({ method: "GET", url: "/orgs", headers: invitee.headers }),
    );
    deepStrictEqual(
      mine.map((o: any) => o.isAdmin),
      [false],
    );

    const twice = await server.inject({
      method: "POST",
      url: `/invitations/${token}/accept`,
      headers: invitee.headers,
    });
    deepStrictEqual(twice.statusCode, 410);
    deepStrictEqual(body(twice).reason, "accepted");
    const unknown = await server.inject({
      method: "POST",
      url: "/invitations/nope/accept",
      headers: invitee.headers,
    });
    deepStrictEqual(unknown.statusCode, 404);
    deepStrictEqual(body(unknown)._tag, "InvitationNotFoundError");

    const admin = await signedInAs("admin@example.com", { superAdmin: true });
    const superAdmin = await server.inject({
      method: "POST",
      url: `/invitations/${token}/accept`,
      headers: admin.headers,
    });
    deepStrictEqual(superAdmin.statusCode, 409);
  });

  it("refuses an expired invitation", async () => {
    const owner = await signedInAs("owner@example.com");
    const invitee = await signedInAs("late@example.com");
    const orgId = await createOrg(owner);
    await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/invitations`,
      headers: owner.headers,
      payload: { email: "late@example.com" },
    });
    await getKnex()("invitations").update({ expires_at: new Date(Date.now() - 1000) });
    const { token } = await getKnex()("invitations").first();
    const res = await server.inject({
      method: "POST",
      url: `/invitations/${token}/accept`,
      headers: invitee.headers,
    });
    deepStrictEqual(res.statusCode, 410);
    deepStrictEqual(body(res).reason, "expired");
    const listed = body(
      await server.inject({
        method: "GET",
        url: `/orgs/${orgId}/invitations`,
        headers: owner.headers,
      }),
    );
    deepStrictEqual(listed.invitations[0].status, "expired");
  });

  it("lists members with emails, promotes, demotes, removes, and lets a member leave", async () => {
    const owner = await signedInAs("owner@example.com");
    const member = await signedInAs("member@example.com");
    const orgId = await createOrg(owner);
    await getKnex()("memberships").insert({ user_id: member.userId, organization_id: orgId });

    const members = body(
      await server.inject({
        method: "GET",
        url: `/orgs/${orgId}/members`,
        headers: member.headers,
      }),
    );
    deepStrictEqual(
      members.members.map((m: any) => [m.email, m.isAdmin]),
      [
        ["owner@example.com", true],
        ["member@example.com", false],
      ],
    );

    const memberInvites = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/invitations`,
      headers: member.headers,
      payload: { email: "x@example.com" },
    });
    deepStrictEqual(memberInvites.statusCode, 403);

    const promoted = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/members/${member.userId}/admin`,
      headers: owner.headers,
    });
    deepStrictEqual(promoted.statusCode, 204);
    const promotedAgain = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/members/${member.userId}/admin`,
      headers: owner.headers,
    });
    deepStrictEqual(promotedAgain.statusCode, 409);
    deepStrictEqual(body(promotedAgain).reason, "already_admin");
    const self = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/members/${owner.userId}/admin`,
      headers: owner.headers,
    });
    deepStrictEqual(self.statusCode, 403);

    const demoted = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/members/${member.userId}/admin`,
      headers: owner.headers,
    });
    deepStrictEqual(demoted.statusCode, 204);
    const demotedAgain = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/members/${member.userId}/admin`,
      headers: owner.headers,
    });
    deepStrictEqual(demotedAgain.statusCode, 409);
    deepStrictEqual(body(demotedAgain).reason, "not_admin");

    const left = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/leave`,
      headers: member.headers,
    });
    deepStrictEqual(left.statusCode, 204);
    const leftAgain = await server.inject({
      method: "POST",
      url: `/orgs/${orgId}/leave`,
      headers: member.headers,
    });
    deepStrictEqual(leftAgain.statusCode, 404);
    deepStrictEqual(body(leftAgain)._tag, "MembershipNotFoundError");

    const removeMissing = await server.inject({
      method: "DELETE",
      url: `/orgs/${orgId}/members/${member.userId}`,
      headers: owner.headers,
    });
    deepStrictEqual(removeMissing.statusCode, 404);
    const stranger = await server.inject({
      method: "GET",
      url: `/orgs/${orgId}/members`,
      headers: member.headers,
    });
    deepStrictEqual(stranger.statusCode, 403);
  });
});
