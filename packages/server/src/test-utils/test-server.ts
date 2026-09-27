import "reflect-metadata";

import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { paths } from "@org/contracts";
import type { CurrentUser } from "@org/contracts/Policy";
import type { Database } from "@org/database";
import createClient, { type Client } from "openapi-fetch";

import { EnvVars } from "@/common/env-vars.js";
import { BillingGateway, BillingGatewayFake } from "@/modules/billing/billing.platform.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { AppQueryBus } from "@/platform/cqrs/query-bus.js";
import { Database as DatabaseToken } from "@/platform/database/database.js";
import { UserAuthGuard } from "@/platform/middlewares/user-auth.guard.js";
import { AppModule } from "@/platform/modules/application-modules.js";
import { Mailer } from "@/platform/notifications/mailer.js";

import { SUPER_ADMIN_CALLER, UserAuthGuardFake } from "./fake-auth-guard.js";
import { MailerFake } from "./mailer-fake.js";
import { assertTestDatabaseConfigured, createTestDatabase } from "./test-database.js";

export type ApiClient = Client<paths>;

export type TestServer = {
  readonly app: INestApplication;
  readonly client: ApiClient;
  readonly baseUrl: string;
  readonly database: Database;
  readonly commandBus: AppCommandBus;
  readonly queryBus: AppQueryBus;
  readonly mailer: MailerFake;
  readonly billingGateway: BillingGatewayFake;
  readonly close: () => Promise<void>;
};

const TEST_ENV: Readonly<Record<string, string>> = {
  DATABASE_URL: "postgres://unused",
  ZITADEL_ISSUER: "http://localhost:8080",
  ZITADEL_CLIENT_ID: "test-client",
  ZITADEL_CLIENT_SECRET: "test-secret",
  SESSION_COOKIE_SECRET: "test-cookie-secret",
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_PRICE_ID_DEFAULT: "price_test",
};

// The same application production runs. What this root does differently is
// the environment below: a test database, a fixed caller in place of the
// auth guard, a recording mailer, and billing's fake gateway.
export const startTestServer = async (
  caller: CurrentUser = SUPER_ADMIN_CALLER,
): Promise<TestServer> => {
  const database = await createTestDatabase();
  const mailer = new MailerFake();
  const billingGateway = new BillingGatewayFake();
  const env = EnvVars.load({ ...TEST_ENV, DATABASE_URL: assertTestDatabaseConfigured() });
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EnvVars)
    .useValue(env)
    .overrideProvider(DatabaseToken)
    .useValue(database)
    .overrideProvider(Mailer)
    .useValue(mailer)
    .overrideProvider(BillingGateway)
    .useValue(billingGateway)
    .overrideGuard(UserAuthGuard)
    .useValue(new UserAuthGuardFake(caller))
    .compile();
  const app = moduleRef.createNestApplication({ rawBody: true, logger: ["error"] });
  await app.init();
  await app.listen(0);
  const baseUrl = (await app.getUrl()).replace("[::1]", "127.0.0.1");
  return {
    app,
    client: createClient<paths>({ baseUrl }),
    baseUrl,
    database,
    commandBus: app.get(AppCommandBus),
    queryBus: app.get(AppQueryBus),
    mailer,
    billingGateway,
    close: async () => {
      await app.close();
      await database.end();
    },
  };
};
