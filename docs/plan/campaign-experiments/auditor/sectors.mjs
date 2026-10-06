// What the auditor knows about a sector, written from the code and from Appendix A of
// ../03-ab-plan-vs-campaign.md, never from the campaign's manifest or detectors.
//
// An operation is "METHOD path" as the hapi route declares it.

export const sectors = {
  // Billing is the calibration sector: its stack is known good, and experiment 1's
  // faults were planted in it.
  billing: {
    legacyFolder: "packages/legacy-api/src/application/billing/",
    routeFiles: ["packages/legacy-api/src/application/billing/billing-routes.ts"],
    groups: {
      "subscription-lifecycle": [
        "POST /orgs/{orgId}/billing/subscriptions",
        "DELETE /orgs/{orgId}/billing/subscriptions/current",
        "POST /webhooks/stripe",
      ],
    },
    reads: ["GET /orgs/{orgId}/billing/subscriptions/current"],
    // Tables whose readers outside the sector need the reverse forward (I9, I10). Billing has none.
    outsideReadTables: [],
    nestModule: "packages/server/src/modules/billing/",
    attestationFile: ".architecture-campaigns/strangle-hapi/sectors/billing.json",
  },

  organization: {
    legacyFolder: "packages/legacy-api/src/application/organization/",
    routeFiles: [
      "packages/legacy-api/src/application/organization/organization-routes.ts",
      "packages/legacy-api/src/application/organization/organization-cli-routes.ts",
    ],
    groups: {
      "organization-writes": [
        "POST /orgs",
        "DELETE /orgs/{id}",
        "POST /orgs/{id}/restore",
        "POST /orgs/{orgId}/invitations",
        "DELETE /orgs/{orgId}/invitations/{invitationId}",
        "POST /orgs/{orgId}/invitations/{invitationId}/resend",
        "POST /invitations/{token}/accept",
        "DELETE /orgs/{orgId}/members/{userId}",
        "POST /orgs/{orgId}/leave",
        "POST /orgs/{orgId}/members/{userId}/admin",
        "DELETE /orgs/{orgId}/members/{userId}/admin",
        // D2's archive route joins the group whether or not an agent declares it (I4).
        "PUT /orgs/{orgId}/archive",
      ],
    },
    reads: [
      "GET /orgs",
      "GET /orgs/{orgId}/invitations",
      "GET /orgs/{orgId}/members",
      "GET /admin/orgs",
      "GET /cli/orgs",
    ],
    outsideReadTables: ["organizations", "memberships", "organization_roles"],
    nestModule: "packages/server/src/modules/organization/",
    attestationFile: ".architecture-campaigns/strangle-hapi/sectors/organization.json",
  },
};
