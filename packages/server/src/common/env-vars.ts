import { z } from "zod";

const optionalNumber = (fallback: number) => z.coerce.number().int().default(fallback);

const EnvSchema = z.object({
  PORT: optionalNumber(3001),
  ENV: z.enum(["dev", "prod", "staging"]).default("dev"),
  APP_URL: z
    .url()
    .default("http://localhost:3000")
    .transform((url) => new URL(url).origin),

  DATABASE_URL: z.string().min(1),

  OTLP_URL: z.url().default("http://jaeger:4318/v1/traces"),

  ZITADEL_ISSUER: z.url().transform((url) => url.replace(/\/$/, "")),
  ZITADEL_CLIENT_ID: z.string().min(1),
  ZITADEL_CLIENT_SECRET: z.string().min(1),
  ZITADEL_REDIRECT_URI: z.string().default("http://localhost:3000/api/auth/callback"),
  ZITADEL_POST_LOGOUT_REDIRECT_URI: z.string().default("http://localhost:3000/"),

  SESSION_COOKIE_NAME: z.string().default("session"),
  SESSION_COOKIE_SECRET: z.string().min(1),
  SESSION_TTL_SECONDS: optionalNumber(3600),
  SESSION_ABSOLUTE_TTL_SECONDS: optionalNumber(43200),
  SESSION_TOUCH_THRESHOLD_SECONDS: optionalNumber(60),

  API_TOKEN_DEFAULT_TTL_DAYS: optionalNumber(90),
  API_TOKEN_TOUCH_THRESHOLD_SECONDS: optionalNumber(60),

  DEVICE_CODE_TTL_SECONDS: optionalNumber(600),
  DEVICE_POLL_INTERVAL_SECONDS: optionalNumber(5),

  MAILER: z.enum(["log", "smtp", "ses"]).default("log"),
  MAIL_FROM: z.string().default("Nest Hexagon <noreply@localhost>"),
  MAIL_SMTP_HOST: z.string().default("localhost"),
  MAIL_SMTP_PORT: optionalNumber(1025),
  MAIL_SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  MAIL_SMTP_USER: z.string().default(""),
  MAIL_SMTP_PASSWORD: z.string().default(""),

  STRIPE_SECRET_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),
  STRIPE_PRICE_ID_DEFAULT: z.string().min(1),
});

type ParsedEnv = z.infer<typeof EnvSchema>;

// The typed environment, read once at boot. The class is the DI token; the
// interface gives it the parsed shape without restating thirty fields.
export interface EnvVars extends ParsedEnv {}
export class EnvVars {
  constructor(parsed: ParsedEnv) {
    Object.assign(this, parsed);
  }

  public static load(source: Readonly<Record<string, string | undefined>> = process.env): EnvVars {
    return new EnvVars(EnvSchema.parse(source));
  }
}
