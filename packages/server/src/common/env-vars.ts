import { z } from "zod";

const optionalNumber = (fallback: number) => z.coerce.number().int().default(fallback);

const EnvSchema = z.object({
  PORT: optionalNumber(3001),
  ENV: z.enum(["dev", "prod", "staging"]).default("dev"),

  DATABASE_URL: z.string().min(1),

  OTLP_URL: z.url().default("http://jaeger:4318/v1/traces"),

  // Shared with the legacy API, which mints the HS256 token every call carries.
  INTER_SERVICE_JWT_SECRET: z.string().min(32),

  // Shared with the legacy API, which issues the session cookie and the API
  // tokens this server verifies against the rows it wrote.
  SESSION_COOKIE_NAME: z.string().default("session"),
  SESSION_COOKIE_SECRET: z.string().min(1),
  SESSION_TTL_SECONDS: optionalNumber(3600),
  SESSION_TOUCH_THRESHOLD_SECONDS: optionalNumber(60),
  API_TOKEN_TOUCH_THRESHOLD_SECONDS: optionalNumber(60),

  // The in-memory gateway stands in for Stripe when this is true, as it does
  // on the legacy API; otherwise the live gateway refuses to start without
  // the three keys below.
  STRIPE_USE_FAKE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_ID_DEFAULT: z.string().default(""),
});

type ParsedEnv = z.infer<typeof EnvSchema>;

// The typed environment, read once at boot. The class is the DI token; the
// interface gives it the parsed shape without restating the fields.
export interface EnvVars extends ParsedEnv {}
export class EnvVars {
  constructor(parsed: ParsedEnv) {
    Object.assign(this, parsed);
  }

  public static load(source: Readonly<Record<string, string | undefined>> = process.env): EnvVars {
    return new EnvVars(EnvSchema.parse(source));
  }
}
