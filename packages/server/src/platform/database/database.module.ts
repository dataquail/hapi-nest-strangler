import { Global, Module } from "@nestjs/common";
import { createDatabase } from "@org/database";

import { EnvVars } from "@/common/env-vars.js";

import { Database } from "./database.js";

@Global()
@Module({
  providers: [
    {
      provide: Database,
      inject: [EnvVars],
      useFactory: (env: EnvVars) =>
        createDatabase({ url: env.DATABASE_URL, ssl: env.ENV === "prod" }),
    },
  ],
  exports: [Database],
})
export class DatabaseModule {}
