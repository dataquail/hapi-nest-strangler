import { type Database, sql } from "../database.js";

export type BackfillReport = { readonly upserted: number; readonly deleted: number };

// Squares the Nest replica with the legacy table once every write is
// mirrored: the legacy API is still the source of truth, so its rows win and
// a row it no longer has goes. Idempotent — a second run changes nothing.
export const backfillTodos = (db: Database): Promise<BackfillReport> =>
  db.withTransaction(async () => {
    const upserted = await db.exec(sql.unsafe`
      INSERT INTO todos.todos (id, organization_id, title, completed, created_at, updated_at)
      SELECT id, organization_id, title, completed, created_at, updated_at FROM public.todos
      ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        title = EXCLUDED.title,
        completed = EXCLUDED.completed,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at
    `);
    const deleted = await db.exec(sql.unsafe`
      DELETE FROM todos.todos WHERE id NOT IN (SELECT id FROM public.todos)
    `);
    return { upserted, deleted };
  });
