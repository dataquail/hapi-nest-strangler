import type { OrganizationContract } from "@org/contracts/api/Contracts";
import { InvitationId, OrganizationId, UserId } from "@org/contracts/EntityIds";

const FIXED_DATE = "2026-01-01T00:00:00.000Z";

export const ORG_A_ID = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
export const ORG_B_ID = OrganizationId.parse("22222222-2222-2222-2222-222222222222");

/** The shape `findMine` returns. */
export const makeMyOrganization = (
  overrides: Partial<OrganizationContract.MyOrganization> = {},
): OrganizationContract.MyOrganization => ({
  id: ORG_A_ID,
  name: "Org A",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  deletedAt: null,
  isAdmin: true,
  ...overrides,
});

export const makeCreateOrganizationPayload = (
  overrides: Partial<OrganizationContract.CreateOrganizationPayload> = {},
): OrganizationContract.CreateOrganizationPayload => ({ name: "Acme Inc.", ...overrides });

/** A row of the super-admin listing. */
export const makeOrganization = (
  overrides: Partial<OrganizationContract.Organization> = {},
): OrganizationContract.Organization => ({
  id: ORG_A_ID,
  name: "Org A",
  createdAt: FIXED_DATE,
  updatedAt: FIXED_DATE,
  deletedAt: null,
  ...overrides,
});

export const makePaginatedOrganizations = (
  overrides: Partial<OrganizationContract.PaginatedOrganizations> = {},
): OrganizationContract.PaginatedOrganizations => {
  const organizations = overrides.organizations ?? [makeOrganization()];
  return { organizations, page: 1, pageSize: 10, total: organizations.length, ...overrides };
};

export const makeOrganizationMember = (
  overrides: Partial<OrganizationContract.OrganizationMember> = {},
): OrganizationContract.OrganizationMember => ({
  userId: UserId.parse("11111111-1111-1111-1111-111111111111"),
  email: "alice@example.com",
  joinedAt: FIXED_DATE,
  isAdmin: false,
  ...overrides,
});

export const makePendingInvitation = (
  overrides: Partial<OrganizationContract.PendingInvitation> = {},
): OrganizationContract.PendingInvitation => ({
  invitationId: InvitationId.parse("77777777-7777-7777-7777-777777777777"),
  inviteeEmail: "invitee@example.com",
  status: "pending",
  expiresAt: FIXED_DATE,
  createdAt: FIXED_DATE,
  ...overrides,
});
