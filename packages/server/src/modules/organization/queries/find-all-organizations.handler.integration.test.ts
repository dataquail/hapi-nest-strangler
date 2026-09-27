import { deepStrictEqual } from "node:assert";

import type { Database } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { OrganizationRootOps } from "../domain/organization/organization.root-ops.js";
import { OrganizationRepositoryLive } from "../infrastructure/repositories/organization.repository-live.js";
import { FindAllOrganizationsHandler } from "./find-all-organizations.handler.js";
import { FindAllOrganizationsQuery } from "./find-all-organizations.query.js";

const acmeId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const betaId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const now = new Date("2026-01-01T00:00:00Z");
const later = new Date("2026-02-01T00:00:00Z");

describe.sequential("FindAllOrganizationsHandler (integration)", () => {
  let db: Database;
  let orgs: OrganizationRepositoryLive;
  let handler: FindAllOrganizationsHandler;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    orgs = new OrganizationRepositoryLive(db);
    handler = new FindAllOrganizationsHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "organization.organizations");
  });

  const seedAcmeAndDeletedBeta = async () => {
    (
      await orgs.insertOne(
        OrganizationRootOps.create({ id: acmeId, name: "Acme", now }).organization,
      )
    ).unwrap();
    const { organization: beta } = OrganizationRootOps.create({ id: betaId, name: "Beta", now });
    (await orgs.insertOne(beta)).unwrap();
    const deleted = OrganizationRootOps.softDelete(beta, { now: later }).unwrap();
    (await orgs.updateOne(deleted.organization)).unwrap();
  };

  it("hides soft-deleted orgs by default", async () => {
    await seedAcmeAndDeletedBeta();
    const result = (
      await handler.execute(
        new FindAllOrganizationsQuery({ page: 1, pageSize: 10, includeDeleted: false }),
      )
    ).unwrap();
    deepStrictEqual(result.total, 1);
    deepStrictEqual(result.organizations[0]?.name, "Acme");
  });

  it("returns tombstoned rows when includeDeleted is true", async () => {
    await seedAcmeAndDeletedBeta();
    const result = (
      await handler.execute(
        new FindAllOrganizationsQuery({ page: 1, pageSize: 10, includeDeleted: true }),
      )
    ).unwrap();
    deepStrictEqual(result.total, 2);
  });

  it("returns empty + total=0 on an empty table", async () => {
    const result = (
      await handler.execute(
        new FindAllOrganizationsQuery({ page: 1, pageSize: 10, includeDeleted: false }),
      )
    ).unwrap();
    deepStrictEqual(result.total, 0);
    deepStrictEqual([...result.organizations], []);
  });
});
