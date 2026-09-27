import { isDatabaseError, isDatabaseUnavailable } from "@org/database";
import { PersistenceUnavailable } from "@org/unit-of-work";
import { Err, Ok, type Result } from "oxide.ts";

/**
 * Runs a statement and speaks the ports' vocabulary: a transient outage is
 * `Err(PersistenceUnavailable)`, a constraint violation is a defect unless the
 * caller maps it, anything else is rethrown.
 */
export const translateDatabaseErrors = async <A, E = never>(
  run: () => Promise<A>,
  onConstraint?: (error: { readonly type: string; readonly constraint: string | null }) => E | null,
): Promise<Result<A, E | PersistenceUnavailable>> => {
  try {
    return Ok(await run());
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return Err(new PersistenceUnavailable({ message: error.message }));
    }
    if (isDatabaseError(error) && onConstraint !== undefined) {
      const mapped = onConstraint(error);
      if (mapped !== null) return Err(mapped);
    }
    throw error;
  }
};
