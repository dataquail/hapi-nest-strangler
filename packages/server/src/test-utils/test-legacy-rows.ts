import { randomUUID } from "node:crypto";

import { type Database, sql } from "@org/database";

// Rows the legacy API owns, seeded straight into `public` because the Nest
// server has no way to create them yet: the modules that would are still hapi's.
export const seedLegacyUser = async (db: Database, userId: string): Promise<void> => {
  await db.exec(sql.unsafe`
    INSERT INTO public.users (id, email) VALUES (${userId}, ${`${userId}@test.local`})
    ON CONFLICT (id) DO NOTHING
  `);
};

export const seedLegacySuperAdmin = async (db: Database, userId: string): Promise<void> => {
  await db.exec(sql.unsafe`
    INSERT INTO public.roles (user_id, role) VALUES (${userId}, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING
  `);
};

export const seedLegacyOrganization = async (db: Database, name: string): Promise<string> => {
  const id = randomUUID();
  await db.exec(sql.unsafe`INSERT INTO public.organizations (id, name) VALUES (${id}, ${name})`);
  return id;
};

export const seedLegacyMembership = async (
  db: Database,
  userId: string,
  organizationId: string,
): Promise<void> => {
  await db.exec(sql.unsafe`
    INSERT INTO public.memberships (user_id, organization_id) VALUES (${userId}, ${organizationId})
  `);
};

export const seedLegacyOrganizationRole = async (
  db: Database,
  userId: string,
  organizationId: string,
  role: string,
): Promise<void> => {
  await db.exec(sql.unsafe`
    INSERT INTO public.organization_roles (organization_id, user_id, role, issued_by)
    VALUES (${organizationId}, ${userId}, ${role}, ${userId})
  `);
};

export const seedMemberOrganization = async (
  db: Database,
  userId: string,
  name: string,
): Promise<string> => {
  const organizationId = await seedLegacyOrganization(db, name);
  await seedLegacyMembership(db, userId, organizationId);
  return organizationId;
};
