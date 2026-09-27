import "../../load-env";

import type { Knex } from "knex";

import config = require("../../config");
import * as logger from "../lib/logger";
import { connect } from "../lib/migrator";

// Stable transaction-scoped advisory lock: only its holder runs the DELETE,
// every other replica short-circuits, and it releases with the transaction.
const PURGE_EXPIRED_SESSIONS_LOCK_KEY = "6438907123819245189";

export type PurgeResult = { rowsPurged: number; skipped: boolean };

// Revoked rows stay 7 days as an audit trail; expired-but-unrevoked rows have
// no audit value and go as soon as they lapse.
export const purgeExpiredSessions = (knex: Knex): Promise<PurgeResult> =>
  knex.transaction(async (trx) => {
    const lock = await trx.raw(`SELECT pg_try_advisory_xact_lock(?::bigint) AS acquired`, [
      PURGE_EXPIRED_SESSIONS_LOCK_KEY,
    ]);
    if (!lock.rows[0].acquired) return { rowsPurged: 0, skipped: true };
    const deleted = await trx("sessions")
      .where("expires_at", "<", trx.fn.now())
      .orWhere((qb) => {
        qb.whereNotNull("revoked_at").andWhere(
          "revoked_at",
          "<",
          trx.raw("now() - interval '7 days'"),
        );
      })
      .del();
    return { rowsPurged: deleted, skipped: false };
  });

if (require.main === module) {
  const knex = connect(config("/db/connection"));
  purgeExpiredSessions(knex)
    .then((result) => {
      logger.info(
        result.skipped
          ? "another instance holds the advisory lock; skipping this run"
          : `purged ${result.rowsPurged} expired/aged-out session row(s)`,
      );
    })
    .catch((error) => {
      logger.error("session purge failed", error);
      process.exitCode = 1;
    })
    .finally(() => {
      void knex.destroy();
    });
}
