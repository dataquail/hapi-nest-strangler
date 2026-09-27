import { Global, Module } from "@nestjs/common";

import { EnvVars } from "@/common/env-vars.js";

import { LogMailerLive } from "./log-mailer-live.js";
import { Mailer } from "./mailer.js";
import { SesMailerLive } from "./ses-mailer-live.js";
import { SmtpMailerLive } from "./smtp-mailer-live.js";

// The transport is picked by MAILER at boot; every consumer names the port.
@Global()
@Module({
  providers: [
    {
      provide: Mailer,
      inject: [EnvVars],
      useFactory: (env: EnvVars): Mailer => {
        switch (env.MAILER) {
          case "smtp":
            return new SmtpMailerLive(env);
          case "ses":
            return new SesMailerLive(env);
          case "log":
            return new LogMailerLive();
        }
      },
    },
  ],
  exports: [Mailer],
})
export class NotificationsModule {}
