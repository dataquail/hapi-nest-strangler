import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import * as dotenv from "dotenv";

import { EnvVars } from "@/common/env-vars.js";
import { AppModule } from "@/platform/modules/application-modules.js";

dotenv.config({ path: "../../.env" });

const bootstrap = async (): Promise<void> => {
  const env = EnvVars.load();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.enableCors({ origin: env.APP_URL, credentials: true });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  process.stdout.write(`Server listening on http://localhost:${env.PORT}\n`);
};

void bootstrap();
