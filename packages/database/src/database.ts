import { AsyncLocalStorage } from "node:async_hooks";

import { createPgDriverFactory } from "@slonik/pg-driver";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import {
  type CommonQueryMethods,
  createPool,
  createSqlTag,
  createTypeParserPreset,
  type DatabasePool,
  type DatabaseTransactionConnection,
  type DriverTypeParser,
  type Interceptor,
  type QuerySqlToken,
  SchemaValidationError,
} from "slonik";

import { translateDatabaseError } from "./errors.js";

export type DatabaseConfig = {
  readonly url: string;
  readonly ssl: boolean;
  readonly maximumPoolSize?: number;
};

export const sql = createSqlTag();

/**
 * The client every repository and query handler speaks. Statements resolve the
 * ambient transaction connection before running and fall back to the pool, so
 * joining a unit of work is automatic and unconditional — a read dispatched
 * inside a command's transaction sees that command's uncommitted state.
 */
export type Database = {
  readonly any: <T>(
    query: QuerySqlToken<StandardSchemaV1<unknown, T>>,
  ) => Promise<ReadonlyArray<T>>;
  readonly maybeOne: <T>(query: QuerySqlToken<StandardSchemaV1<unknown, T>>) => Promise<T | null>;
  readonly one: <T>(query: QuerySqlToken<StandardSchemaV1<unknown, T>>) => Promise<T>;
  /** Runs a statement for its effect; resolves to the number of rows it touched. */
  readonly exec: (query: QuerySqlToken) => Promise<number>;
  /** Depth-aware: the outermost call opens a transaction, a nested call a savepoint. */
  readonly withTransaction: <A>(fn: () => Promise<A>) => Promise<A>;
  readonly hasOpenTransaction: () => boolean;
  readonly end: () => Promise<void>;
};

type Scope = { readonly transaction: DatabaseTransactionConnection };

// Timestamps arrive as Date, not the epoch numbers slonik's preset would give,
// and int8 as number: the columns this application declares bigint hold sums a
// JavaScript number represents exactly.
const timestampAsDate = (name: string): DriverTypeParser => ({
  name,
  parse: (value: string | null) => (value === null ? null : new Date(value)),
});

const int8AsNumber: DriverTypeParser = {
  name: "int8",
  parse: (value: string) => Number(value),
};

const typeParsers = (): ReadonlyArray<DriverTypeParser> => [
  ...createTypeParserPreset().filter(
    (parser) =>
      parser.name !== "int8" && parser.name !== "timestamp" && parser.name !== "timestamptz",
  ),
  int8AsNumber,
  timestampAsDate("timestamp"),
  timestampAsDate("timestamptz"),
];

// A row that does not match the schema `sql.type(...)` named is a defect: the
// interceptor makes every typed query validated, so a `sql<Row>` claim can
// never be a type-level lie the way an untyped driver's would.
const resultParserInterceptor: Interceptor = {
  name: "zod-result-parser",
  transformRow: (queryContext, query, row) => {
    const parser = queryContext.resultParser;
    if (parser === undefined) return row;
    const outcome = parser["~standard"].validate(row);
    if (outcome instanceof Promise) {
      throw new Error("Row schemas must validate synchronously");
    }
    if (outcome.issues !== undefined) {
      throw new SchemaValidationError(query, row, outcome.issues);
    }
    return outcome.value as typeof row;
  },
};

const translating = async <A>(run: () => Promise<A>): Promise<A> => {
  try {
    return await run();
  } catch (error) {
    throw translateDatabaseError(error);
  }
};

const NO_RETRIES = 0;

export const createDatabase = async (config: DatabaseConfig): Promise<Database> => {
  const pool: DatabasePool = await createPool(config.url, {
    driverFactory: createPgDriverFactory(),
    interceptors: [resultParserInterceptor],
    typeParsers: typeParsers(),
    ...(config.maximumPoolSize === undefined ? {} : { maximumPoolSize: config.maximumPoolSize }),
    ...(config.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  });
  const storage = new AsyncLocalStorage<Scope>();

  const connection = (): CommonQueryMethods => storage.getStore()?.transaction ?? pool;

  const withTransaction = <A>(fn: () => Promise<A>): Promise<A> => {
    const enclosing = storage.getStore();
    if (enclosing !== undefined) {
      return translating(() =>
        enclosing.transaction.transaction(
          (nested) => storage.run({ transaction: nested }, fn),
          NO_RETRIES,
        ),
      );
    }
    return translating(() =>
      pool.transaction((transaction) => storage.run({ transaction }, fn), NO_RETRIES),
    );
  };

  return {
    any: (query) => translating(() => connection().any(query)),
    maybeOne: (query) => translating(() => connection().maybeOne(query)),
    one: (query) => translating(() => connection().one(query)),
    exec: (query) => translating(async () => (await connection().query(query)).rowCount),
    withTransaction,
    hasOpenTransaction: () => storage.getStore() !== undefined,
    end: () => pool.end(),
  };
};
