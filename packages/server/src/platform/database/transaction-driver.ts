import { isDatabaseError, isDatabaseUnavailable } from "@org/database";
import {
  PersistenceUnavailable,
  type TransactionDriver as TransactionDriverPort,
  TransactionFailed,
} from "@org/unit-of-work";

import type { Database } from "./database.js";

// The one file that knows a unit of work is a database transaction. A
// constraint violation escaping to the boundary is the boundary failing —
// repositories translate their own — so it becomes TransactionFailed.
export const makeTransactionDriver = (database: Database): TransactionDriverPort => {
  const translate = async <A>(run: () => Promise<A>): Promise<A> => {
    try {
      return await run();
    } catch (error) {
      if (isDatabaseError(error)) {
        throw new TransactionFailed({ message: error.message, cause: error });
      }
      if (isDatabaseUnavailable(error)) {
        throw new PersistenceUnavailable({ message: error.message });
      }
      throw error;
    }
  };
  return {
    withTransaction: (fn) => translate(() => database.withTransaction(fn)),
    withSavepoint: (fn) => translate(() => database.withTransaction(fn)),
    isActive: () => database.hasOpenTransaction(),
  };
};
