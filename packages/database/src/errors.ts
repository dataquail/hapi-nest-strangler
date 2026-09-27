import {
  BackendTerminatedError,
  BackendTerminatedUnexpectedlyError,
  ConnectionError,
  ForeignKeyIntegrityConstraintViolationError,
  IdleTransactionTimeoutError,
  StatementTimeoutError,
  UniqueIntegrityConstraintViolationError,
} from "slonik";

export type DatabaseErrorType = "unique_violation" | "foreign_key_violation";

/** A permanent constraint violation: the repository translates it into a domain error or lets it die. */
export class DatabaseError extends Error {
  public readonly _tag = "DatabaseError" as const;
  public readonly type: DatabaseErrorType;
  public readonly constraint: string | null;
  constructor(props: {
    readonly type: DatabaseErrorType;
    readonly constraint: string | null;
    readonly cause: unknown;
    readonly message: string;
  }) {
    super(props.message, { cause: props.cause });
    this.name = "DatabaseError";
    this.type = props.type;
    this.constraint = props.constraint;
  }
}

/** The store is momentarily unreachable: the transient-retry case, a 503 at the boundary. */
export class DatabaseUnavailable extends Error {
  public readonly _tag = "DatabaseUnavailable" as const;
  constructor(props: { readonly cause: unknown; readonly message: string }) {
    super(props.message, { cause: props.cause });
    this.name = "DatabaseUnavailable";
  }
}

// Postgres SQLSTATE classes that mean "try again later" rather than "your
// statement is wrong": connection exceptions, operator intervention, and
// insufficient resources.
const TRANSIENT_SQLSTATE_PREFIXES = ["08", "57", "53"];
const TRANSIENT_NODE_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "EPIPE"]);

const codeOf = (error: unknown): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === "string") return direct;
  const cause = (error as { cause?: unknown }).cause;
  return cause === undefined ? undefined : codeOf(cause);
};

const isTransient = (error: unknown): boolean => {
  if (
    error instanceof ConnectionError ||
    error instanceof BackendTerminatedError ||
    error instanceof BackendTerminatedUnexpectedlyError ||
    error instanceof StatementTimeoutError ||
    error instanceof IdleTransactionTimeoutError
  ) {
    return true;
  }
  const code = codeOf(error);
  if (code === undefined) return false;
  return (
    TRANSIENT_NODE_CODES.has(code) ||
    TRANSIENT_SQLSTATE_PREFIXES.some((prefix) => code.startsWith(prefix))
  );
};

/**
 * Turns a slonik failure into the vocabulary the ports speak. Anything not a
 * constraint violation or a transient outage is returned untouched — a defect.
 */
export const translateDatabaseError = (error: unknown): unknown => {
  if (error instanceof DatabaseError || error instanceof DatabaseUnavailable) return error;
  if (error instanceof UniqueIntegrityConstraintViolationError) {
    return new DatabaseError({
      type: "unique_violation",
      constraint: error.constraint,
      cause: error,
      message: error.message,
    });
  }
  if (error instanceof ForeignKeyIntegrityConstraintViolationError) {
    return new DatabaseError({
      type: "foreign_key_violation",
      constraint: error.constraint,
      cause: error,
      message: error.message,
    });
  }
  if (isTransient(error)) {
    return new DatabaseUnavailable({
      cause: error,
      message: error instanceof Error ? error.message : String(error),
    });
  }
  return error;
};

export const isDatabaseError = (error: unknown): error is DatabaseError =>
  error instanceof DatabaseError;

export const isDatabaseUnavailable = (error: unknown): error is DatabaseUnavailable =>
  error instanceof DatabaseUnavailable;
