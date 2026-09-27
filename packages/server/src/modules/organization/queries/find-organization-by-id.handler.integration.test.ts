import { deepStrictEqual } from "node:assert";

import { type Database, sql } from "@org/database";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";
import { createTestDatabase, runTestMigrations, truncate } from "@/test-utils/test-database.js";

import { FindOrganizationByIdHandler } from "./find-organization-by-id.handler.js";
import { FindOrganizationByIdQuery } from "./find-organization-by-id.query.js";

const activeOrgId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const deletedOrgId = OrganizationId.parse("22222222-2222-2222-2222-222222222222");
const unknownOrgId = OrganizationId.parse("33333333-3333-3333-3333-333333333333");

describe.sequential("FindOrganizationByIdHandler (integration)", () => {
  let db: Database;
  let handler: FindOrganizationByIdHandler;

  beforeAll(async () => {
    await runTestMigrations();
    db = await createTestDatabase();
    handler = new FindOrganizationByIdHandler(db);
  });

  afterAll(async () => {
    await db.end();
  });

  beforeEach(async () => {
    await truncate(db, "organization.organizations");
    await db.exec(sql.unsafe`
      INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
      VALUES (${activeOrgId}, 'Active', now(), now(), null),
             (${deletedOrgId}, 'Tombstoned', now(), now(), now())
    `);
  });

  it("returns the view for an active organization", async () => {
    const view = (
      await handler.execute(new FindOrganizationByIdQuery({ organizationId: activeOrgId }))
    ).unwrap();
    deepStrictEqual(view, { organizationId: activeOrgId });
  });

  // The restore endpoint resolves a tombstoned org to decide whether the
  // caller may act on it, so soft-deleted rows must not read as absent.
  it("returns the view for a soft-deleted organization", async () => {
    const view = (
      await handler.execute(new FindOrganizationByIdQuery({ organizationId: deletedOrgId }))
    ).unwrap();
    deepStrictEqual(view, { organizationId: deletedOrgId });
  });

  it("returns null for an unknown organization", async () => {
    const view = (
      await handler.execute(new FindOrganizationByIdQuery({ organizationId: unknownOrgId }))
    ).unwrap();
    deepStrictEqual(view, null);
  });
});
