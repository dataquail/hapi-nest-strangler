export const testConfig = {
  env: "test",
  db: {
    connection:
      process.env.DATABASE_URL_TEST ??
      "postgresql://postgres:postgres@localhost:5432/nest-hexagon-test",
  },
  log: { level: "silent", pretty: false },
};
