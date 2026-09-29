// The strangler campaign's marker: every file that moves with this module, on both servers.
export const sector = {
  name: "organization",
  owns: [
    "packages/legacy-api/src/application/organization/**",
    "packages/legacy-api/test/application/organization/**",
    "packages/legacy-api/migrations/*_organizations.ts",
    "packages/legacy-api/migrations/*_memberships.ts",
    "packages/legacy-api/migrations/*_invitations.ts",
    "packages/legacy-api/migrations/*_organization_roles.ts",
    "packages/server/src/modules/organization/**",
  ],
};
