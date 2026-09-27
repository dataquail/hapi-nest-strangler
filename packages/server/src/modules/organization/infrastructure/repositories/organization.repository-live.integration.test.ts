import { deepStrictEqual, notStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationRootOps } from "@/modules/organization/domain/organization/organization.root-ops.js";
import { OrganizationSpecifications } from "@/modules/organization/domain/organization/organization.specification.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { OrganizationRepositoryLive } from "./organization.repository-live.js";

const activeById = (id: OrganizationId) =>
  Spec.and(OrganizationSpecifications.withId(id), OrganizationSpecifications.notDeleted);

const id = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const now = new Date("2026-01-01T00:00:00Z");
const later = new Date("2026-02-01T00:00:00Z");

describe.sequential("OrganizationRepositoryLive (integration)", () => {
  let db: Database;
  let repo: OrganizationRepositoryLive;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    repo = new OrganizationRepositoryLive(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "organization.organizations");
  });

  describe("insert + findOne", () => {
    it("round-trips an inserted org", async () => {
      const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
      (await repo.insertOne(organization)).unwrap();
      const found = (await repo.findOne(activeById(id))).unwrap();
      if (found === null) throw new Error("expected organization");
      deepStrictEqual(found.id, id);
      deepStrictEqual(found.name, "Acme");
      deepStrictEqual(found.deletedAt, null);
    });

    it("findOne returns null for an unknown id", async () => {
      deepStrictEqual((await repo.findOne(activeById(id))).unwrap(), null);
    });
  });

  describe("update (soft-delete tombstone)", () => {
    it("the active-id spec hides a soft-deleted row; withId returns it", async () => {
      const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
      (await repo.insertOne(organization)).unwrap();
      const deleted = OrganizationRootOps.softDelete(organization, { now: later }).unwrap();
      (await repo.updateOne(deleted.organization)).unwrap();

      deepStrictEqual((await repo.findOne(activeById(id))).unwrap(), null);

      const visible = (await repo.findOne(OrganizationSpecifications.withId(id))).unwrap();
      if (visible === null) throw new Error("expected organization");
      notStrictEqual(visible.deletedAt, null);
    });

    it("update fails OrganizationNotFound when the row is missing", async () => {
      const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
      const result = await repo.updateOne(organization);
      deepStrictEqual(result.unwrapErr()._tag, "OrganizationNotFound");
    });
  });
});
