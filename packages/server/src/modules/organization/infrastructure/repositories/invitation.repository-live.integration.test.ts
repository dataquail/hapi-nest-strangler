import { deepStrictEqual, notStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import type { InvitationRoot } from "@/modules/organization/domain/invitation/invitation.root.js";
import { InvitationRootOps } from "@/modules/organization/domain/invitation/invitation.root-ops.js";
import { InvitationSpecifications } from "@/modules/organization/domain/invitation/invitation.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { InvitationId } from "@/platform/ids/invitation-id.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { InvitationRepositoryLive } from "./invitation.repository-live.js";

const invitationId = InvitationId.parse("44444444-4444-4444-4444-444444444444");
const secondId = InvitationId.parse("44444444-4444-4444-4444-444444444445");
const orgId = OrganizationId.parse("55555555-5555-5555-5555-555555555555");
const userId = UserId.parse("66666666-6666-6666-6666-666666666666");
const now = new Date("2026-01-01T00:00:00Z");
const expiresAt = new Date("2026-01-08T00:00:00Z");

const seedOrg = (db: Database): Promise<number> =>
  db.exec(sql.unsafe`
    INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
    VALUES (${orgId}, 'Acme', now(), now(), NULL)
  `);

const seed = (): InvitationRoot =>
  InvitationRootOps.issue({
    id: invitationId,
    organizationId: orgId,
    inviteeEmail: "alice@example.com",
    token: "tok-abc",
    expiresAt,
    now,
  }).invitation;

const openForAlice = Spec.and(
  InvitationSpecifications.forOrganization(orgId),
  InvitationSpecifications.withInviteeEmail("alice@example.com"),
  InvitationSpecifications.isOpen,
);

describe.sequential("InvitationRepositoryLive (integration)", () => {
  let db: Database;
  let repo: InvitationRepositoryLive;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    repo = new InvitationRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "organization.invitations", "organization.organizations");
    await seedOrg(db);
  });

  describe("insert + findOne (by id, by token)", () => {
    it("round-trips an inserted invitation by id and by token", async () => {
      (await repo.insertOne(seed())).unwrap();
      const byId = (await repo.findOne(InvitationSpecifications.withId(invitationId))).unwrap();
      deepStrictEqual(byId?.id, invitationId);
      const byToken = (await repo.findOne(InvitationSpecifications.withToken("tok-abc"))).unwrap();
      deepStrictEqual(byToken?.id, invitationId);
    });

    it("findOne returns null for an unknown id or token (absence is not an error)", async () => {
      deepStrictEqual(
        (await repo.findOne(InvitationSpecifications.withId(invitationId))).unwrap(),
        null,
      );
      deepStrictEqual(
        (await repo.findOne(InvitationSpecifications.withToken("missing"))).unwrap(),
        null,
      );
    });
  });

  describe("update", () => {
    it("persists state transitions (accept sets acceptedAt)", async () => {
      (await repo.insertOne(seed())).unwrap();
      const accepted = InvitationRootOps.accept(seed(), { userId, now }).unwrap();
      (await repo.updateOne(accepted.invitation)).unwrap();
      const found = (await repo.findOne(InvitationSpecifications.withId(invitationId))).unwrap();
      if (found === null) throw new Error("expected invitation");
      notStrictEqual(found.acceptedAt, null);
    });

    it("persists a reissue (rotated token + reset expiry)", async () => {
      (await repo.insertOne(seed())).unwrap();
      const newExpiresAt = new Date("2026-02-01T00:00:00Z");
      const reissued = InvitationRootOps.reissue(seed(), {
        token: "tok-rotated",
        expiresAt: newExpiresAt,
        now,
      }).unwrap();
      (await repo.updateOne(reissued.invitation)).unwrap();

      const byNew = (
        await repo.findOne(InvitationSpecifications.withToken("tok-rotated"))
      ).unwrap();
      if (byNew === null) throw new Error("expected invitation");
      deepStrictEqual(byNew.id, invitationId);
      deepStrictEqual(byNew.expiresAt.getTime(), newExpiresAt.getTime());

      deepStrictEqual(
        (await repo.findOne(InvitationSpecifications.withToken("tok-abc"))).unwrap(),
        null,
      );
    });

    it("update fails InvitationNotFound when the row is missing", async () => {
      const result = await repo.updateOne(seed());
      deepStrictEqual(result.unwrapErr()._tag, "InvitationNotFound");
    });
  });

  describe("findOne / findMany by specification", () => {
    it("findOne compiles a composed spec (org + email + open) to SQL", async () => {
      (await repo.insertOne(seed())).unwrap();
      const found = (await repo.findOne(openForAlice)).unwrap();
      deepStrictEqual(found?.id, invitationId);
    });

    it("the open variant is applied in SQL: a revoked invite is excluded", async () => {
      (await repo.insertOne(seed())).unwrap();
      const revoked = InvitationRootOps.revoke(seed(), { now }).unwrap();
      (await repo.updateOne(revoked.invitation)).unwrap();

      deepStrictEqual((await repo.findOne(openForAlice)).unwrap(), null);
      const all = (await repo.findMany(InvitationSpecifications.forOrganization(orgId))).unwrap();
      deepStrictEqual(all.length, 1);
      notStrictEqual(all[0]?.revokedAt, null);
    });

    it("findMany(forOrganization) returns every invitation, newest first", async () => {
      (await repo.insertOne(seed())).unwrap();
      const later = InvitationRootOps.issue({
        id: secondId,
        organizationId: orgId,
        inviteeEmail: "bob@example.com",
        token: "tok-bob",
        expiresAt,
        now: new Date("2026-01-02T00:00:00Z"),
      }).invitation;
      (await repo.insertOne(later)).unwrap();
      const all = (await repo.findMany(InvitationSpecifications.forOrganization(orgId))).unwrap();
      deepStrictEqual(all.length, 2);
      deepStrictEqual(all[0]?.id, secondId);
      deepStrictEqual(all[1]?.id, invitationId);
    });
  });
});
