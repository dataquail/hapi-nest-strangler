export const testConfig = {
  env: "test",
  db: {
    connection:
      process.env.DATABASE_URL_TEST ??
      "postgresql://postgres:postgres@localhost:5432/nest-hexagon-test",
  },
  log: { level: "silent", pretty: false },
  appUrl: "http://app.test",
  // The suite starts its own wallet server and identity provider on these
  // ports; an environment that names the real ones (CI does) must not win.
  backend: { url: "http://127.0.0.1:18081" },
  mail: { transport: "log" },
  stripe: { useFake: true },
  auth: {
    interServiceJWTSecret: "test-inter-service-secret-0123456789abcdef",
    sessionCookieSecret: "test-session-cookie-secret",
    sessionTouchThresholdSeconds: 0,
    zitadel: {
      issuer: "http://127.0.0.1:18080",
      clientId: "test-client",
      clientSecret: "test-secret",
      redirectUri: "http://app.test/api/auth/callback",
      postLogoutRedirectUri: "http://app.test/",
    },
  },
};
