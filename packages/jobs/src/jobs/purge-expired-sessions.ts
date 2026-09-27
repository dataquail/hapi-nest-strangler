import { trace } from "@opentelemetry/api";
import { type Database, sql } from "@org/database";
import { z } from "zod";

// Stable transaction-scoped advisory lock: only its holder runs the DELETE,
// every other replica short-circuits, and it releases with the transaction.
// Picked once and never changed; other jobs must use distinct keys.
const PURGE_EXPIRED_SESSIONS_LOCK_KEY = "6438907123819245189";

export type PurgeResult = { readonly rowsPurged: number; readonly skipped: boolean };

const LockRow = z.object({ acquired: z.boolean() });
const IdRow = z.object({ id: z.string() });

// Revoked rows stay 7 days as an audit trail; expired-but-unrevoked rows have
// no audit value and go as soon as they lapse. The interval is a literal
// because `interval $1` is not valid Postgres.
export const purgeExpiredSessions = (db: Database): Promise<PurgeResult> =>
  trace.getTracer("@org/jobs").startActiveSpan("jobs.purge-expired-sessions", async (span) => {
    try {
      const result = await db.withTransaction(async () => {
        const lock = await db.one(sql.type(LockRow)`
          SELECT pg_try_advisory_xact_lock(${PURGE_EXPIRED_SESSIONS_LOCK_KEY}::bigint) AS acquired
        `);
        if (!lock.acquired) return { rowsPurged: 0, skipped: true } satisfies PurgeResult;
        const deleted = await db.any(sql.type(IdRow)`
          DELETE FROM auth.sessions
          WHERE expires_at < now()
             OR (revoked_at IS NOT NULL AND revoked_at < now() - interval '7 days')
          RETURNING id::text AS id
        `);
        return { rowsPurged: deleted.length, skipped: false } satisfies PurgeResult;
      });
      console.info(
        result.skipped
          ? "[jobs.purge-expired-sessions] another instance holds the advisory lock; skipping this run"
          : `[jobs.purge-expired-sessions] purged ${result.rowsPurged} expired/aged-out session row(s)`,
      );
      return result;
    } finally {
      span.end();
    }
  });
