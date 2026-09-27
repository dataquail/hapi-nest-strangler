export const testConfig = {
  env: "test",
  db: {
    connection:
      process.env.DATABASE_URL_TEST ??
      "postgresql://postgres:postgres@localhost:5432/nest-hexagon-test",
  },
  log: { level: "silent", pretty: false },
  appUrl: "http://app.test",
  auth: {
    sessionCookieSecret: "test-session-cookie-secret",
    sessionTouchThresholdSeconds: 0,
    zitadel: {
      issuer: process.env.ZITADEL_ISSUER ?? "http://127.0.0.1:18080",
      clientId: "test-client",
      clientSecret: "test-secret",
      redirectUri: "http://app.test/api/auth/callback",
      postLogoutRedirectUri: "http://app.test/",
    },
  },
};
