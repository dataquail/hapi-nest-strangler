import { execFileSync } from "node:child_process";

import { resetAndMigrate } from "@org/database";
import pg from "pg";

import { MEMBER_EMAIL } from "./member-credentials";

// Test-database utilities for the acceptance workspace. Two migrators share
// the test database (ADR-0034): the legacy API owns every `public` table and
// the Nest server owns the `wallet` schema. Both are replayed from scratch,
// and nothing here operates on a DB whose name doesn't contain `test`.

export const DEFAULT_DATABASE_URL_TEST =
  "postgresql://postgres:postgres@localhost:5432/nest-hexagon-test";

const assertTestDbName = (url: string): string => {
  const name = new URL(url).pathname.replace(/^\//, "");
  if (!name.toLowerCase().includes("test")) {
    throw new Error(
      `[acceptance/test-utils] refusing to operate on '${name}' — DATABASE_URL_TEST name must contain 'test'`,
    );
  }
  return url;
};

// The legacy migrator is CommonJS behind its own bin, so it runs as a child
// process; it drops every public table except the Nest migrator's history.
export const runMigrations = async (databaseUrl: string): Promise<void> => {
  assertTestDbName(databaseUrl);
  execFileSync("pnpm", ["-F", "@org/legacy-api", "db:reset:test"], {
    cwd: new URL("../../../", import.meta.url),
    env: { ...process.env, DATABASE_URL_TEST: databaseUrl, ENV_FILE: "disabled" },
    stdio: "inherit",
  });
  await resetAndMigrate({ url: databaseUrl, ssl: false });
};

// The seam's observable: the wallet the Nest server opened for an organization.
export const countWalletsFor = async (
  databaseUrl: string,
  organizationId: string,
): Promise<number> => {
  assertTestDbName(databaseUrl);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM wallet.wallets WHERE organization_id = $1`,
      [organizationId],
    );
    return Number(result.rows[0]?.count ?? 0);
  } finally {
    await pool.end();
  }
};

const splitQualified = (qualified: string): readonly [string, string] => {
  const [schema, table, ...rest] = qualified.split(".");
  if (schema === undefined || table === undefined || rest.length > 0) {
    throw new Error(
      `[acceptance/test-utils] expected "schema.table", got "${qualified}". Acceptance specs name the legacy tables as public.<table> and the Nest tables by their module schema.`,
    );
  }
  return [schema, table];
};

// Truncate is auth-aware: when a spec asks to clear `public.users`, we DELETE
// non-system rows instead of TRUNCATE'ing — a preserved user's session and
// `auth_identities` row would otherwise CASCADE-delete and break the
// storageState cookie for the next spec. We preserve BOTH the admin
// (ZITADEL_ADMIN_EMAIL, seeded by admin-seed.ts) and the regular member
// (MEMBER_EMAIL, JIT-provisioned at member-setup login) so an org-scoped
// spec's member session survives a user-table reset by another spec
// regardless of run order.
export const truncate = async (
  databaseUrl: string,
  tables: ReadonlyArray<string>,
): Promise<void> => {
  assertTestDbName(databaseUrl);
  if (tables.length === 0) return;
  const adminEmail = process.env.ZITADEL_ADMIN_EMAIL ?? "admin@example.com";
  const preservedEmails = [adminEmail, MEMBER_EMAIL];
  const qualified = tables.map(splitQualified);
  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    const usersEntry = qualified.find(([s, t]) => s === "public" && t === "users");
    if (usersEntry !== undefined) {
      await pool.query(`DELETE FROM public.users WHERE email <> ALL($1::text[])`, [
        preservedEmails,
      ]);
      const others = qualified.filter(([s, t]) => !(s === "public" && t === "users"));
      if (others.length > 0) {
        const list = others.map(([s, t]) => `"${s}"."${t}"`).join(", ");
        await pool.query(`TRUNCATE TABLE ${list} CASCADE`);
      }
      return;
    }
    const list = qualified.map(([s, t]) => `"${s}"."${t}"`).join(", ");
    await pool.query(`TRUNCATE TABLE ${list} CASCADE`);
  } finally {
    await pool.end();
  }
};
