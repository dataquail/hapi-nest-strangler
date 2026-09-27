import { z } from "zod";

const optionalNumber = (fallback: number) => z.coerce.number().int().default(fallback);

const EnvSchema = z.object({
  PORT: optionalNumber(3001),
  ENV: z.enum(["dev", "prod", "staging"]).default("dev"),

  DATABASE_URL: z.string().min(1),

  OTLP_URL: z.url().default("http://jaeger:4318/v1/traces"),

  // Shared with the legacy API, which mints the HS256 token every call carries.
  INTER_SERVICE_JWT_SECRET: z.string().min(32),
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
