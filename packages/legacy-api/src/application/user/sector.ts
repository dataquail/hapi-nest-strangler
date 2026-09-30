// The strangler campaign's marker: every file that moves with this module, on both servers.
export const sector = {
  name: "user",
  owns: [
    "packages/legacy-api/src/application/user/**",
    "packages/legacy-api/test/application/user/**",
    "packages/legacy-api/migrations/*_users.ts",
    "packages/legacy-api/migrations/20260927000002_roles.ts",
    "packages/server/src/modules/user/**",
    "packages/server/src/modules/role/**",
  ],
};
