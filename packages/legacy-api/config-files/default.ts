export const defaultConfig = {
  env: "development",
  port: Number(process.env.LEGACY_API_PORT ?? 9000),
  db: {
    connection:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/nest-hexagon",
  },
  log: { level: "info", pretty: true },
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  mail: {
    transport: process.env.MAILER === "smtp" ? "smtp" : "log",
    from: process.env.MAIL_FROM ?? "Legacy API <noreply@localhost>",
    smtp: {
      host: process.env.MAIL_SMTP_HOST ?? "localhost",
      port: Number(process.env.MAIL_SMTP_PORT ?? 1025),
      secure: process.env.MAIL_SMTP_SECURE === "true",
      user: process.env.MAIL_SMTP_USER ?? "",
      password: process.env.MAIL_SMTP_PASSWORD ?? "",
    },
  },
  auth: {
    interServiceJWTSecret: process.env.INTER_SERVICE_JWT_SECRET ?? "",
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "session",
    sessionCookieSecret: process.env.SESSION_COOKIE_SECRET ?? "",
    sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 3600),
    sessionAbsoluteTtlSeconds: Number(process.env.SESSION_ABSOLUTE_TTL_SECONDS ?? 43200),
    sessionTouchThresholdSeconds: Number(process.env.SESSION_TOUCH_THRESHOLD_SECONDS ?? 60),
    apiTokenDefaultTtlDays: Number(process.env.API_TOKEN_DEFAULT_TTL_DAYS ?? 90),
    apiTokenTouchThresholdSeconds: Number(process.env.API_TOKEN_TOUCH_THRESHOLD_SECONDS ?? 60),
    deviceCodeTtlSeconds: Number(process.env.DEVICE_CODE_TTL_SECONDS ?? 600),
    devicePollIntervalSeconds: Number(process.env.DEVICE_POLL_INTERVAL_SECONDS ?? 5),
    zitadel: {
      issuer: process.env.ZITADEL_ISSUER ?? "http://localhost:8080",
      clientId: process.env.ZITADEL_CLIENT_ID ?? "",
      clientSecret: process.env.ZITADEL_CLIENT_SECRET ?? "",
      redirectUri: process.env.ZITADEL_REDIRECT_URI ?? "http://localhost:3000/api/auth/callback",
      postLogoutRedirectUri:
        process.env.ZITADEL_POST_LOGOUT_REDIRECT_URI ?? "http://localhost:3000/",
    },
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY ?? "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    priceId: process.env.STRIPE_PRICE_ID_DEFAULT ?? "",
    useFake: process.env.STRIPE_USE_FAKE === "true",
  },
  backend: {
    url: process.env.NEST_SERVER_URL ?? "http://localhost:3001",
  },
};
