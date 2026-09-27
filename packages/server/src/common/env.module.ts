import { Global, Module } from "@nestjs/common";

import { EnvVars } from "./env-vars.js";

@Global()
@Module({
  providers: [{ provide: EnvVars, useFactory: () => EnvVars.load() }],
  exports: [EnvVars],
})
export class EnvModule {}
