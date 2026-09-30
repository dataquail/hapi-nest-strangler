import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { paths } from "@org/contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { Database } from "@org/database";
import createClient, { type Client } from "openapi-fetch";

import { EnvVars } from "@/common/env-vars.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Database as DatabaseToken } from "@/platform/database/database.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";
import { AppModule } from "@/platform/modules/application-modules.js";

import { SUPER_ADMIN_CALLER, UserAuthGuardFake } from "./fake-auth-guard.js";
import { assertTestDatabaseConfigured, createTestDatabase } from "./test-database.js";
import { mintServiceToken, TEST_SERVICE_SECRET } from "./test-service-token.js";

export type ApiClient = Client<paths>;

export type TestServer = {
  readonly app: INestApplication;
  /** Pre-authenticated as the legacy API: every request carries a valid inter-service token. */
  readonly client: ApiClient;
  readonly baseUrl: string;
  readonly database: Database;
  readonly commandBus: AppCommandBus;
  readonly queryBus: AppQueryBus;
  readonly close: () => Promise<void>;
};

const TEST_ENV: Readonly<Record<string, string>> = {
  DATABASE_URL: "postgres://unused",
  INTER_SERVICE_JWT_SECRET: TEST_SERVICE_SECRET,
  SESSION_COOKIE_SECRET: "test-session-cookie-secret",
};

// The same application production runs. What this root does differently is
// the environment below: a test database, a known inter-service secret, and a
// fixed caller in place of the user auth guard.
export const startTestServer = async (
  caller: CurrentUser = SUPER_ADMIN_CALLER,
): Promise<TestServer> => {
  const database = await createTestDatabase();
  const env = EnvVars.load({ ...TEST_ENV, DATABASE_URL: assertTestDatabaseConfigured() });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EnvVars)
    .useValue(env)
    .overrideProvider(DatabaseToken)
    .useValue(database)
    .overrideGuard(UserAuthGuard)
    .useValue(new UserAuthGuardFake(caller))
    .compile();
  const app = moduleRef.createNestApplication({ rawBody: true, logger: ["error"] });
  await app.init();
  await app.listen(0);
  const baseUrl = (await app.getUrl()).replace("[::1]", "127.0.0.1");
  const serviceToken = await mintServiceToken();
  return {
    app,
    client: createClient<paths>({
      baseUrl,
      headers: { Authorization: `Bearer ${serviceToken}` },
    }),
    baseUrl,
    database,
    commandBus: app.get(AppCommandBus),
    queryBus: app.get(AppQueryBus),
    close: async () => {
      await app.close();
      await database.end();
    },
  };
};
