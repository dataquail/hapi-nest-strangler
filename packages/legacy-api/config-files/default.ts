export const defaultConfig = {
  env: "development",
  port: Number(process.env.LEGACY_API_PORT ?? 9000),
  db: {
    connection:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/nest-hexagon",
  },
  log: { level: "info", pretty: true },
  auth: {
    interServiceJWTSecret: process.env.INTER_SERVICE_JWT_SECRET ?? "",
  },
  backend: {
    url: process.env.NEST_SERVER_URL ?? "http://localhost:3001",
  },
};
