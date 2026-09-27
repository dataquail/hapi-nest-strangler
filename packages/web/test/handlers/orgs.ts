import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";

import {
  makePaginatedOrganizations,
  makePendingInvitation,
  ORG_A_ID,
} from "../fixtures/organization";
import { fail, ok, typedHandler } from "../typed-handler";

const routes = OrganizationContract.Group.routes;

const notFound = () =>
  fail(OrganizationContract.OrganizationNotFoundError, {
    organizationId: ORG_A_ID,
    message: "Org not found.",
  });

const isPage = (
  arg:
    ReadonlyArray<OrganizationContract.Organization> | OrganizationContract.PaginatedOrganizations,
): arg is OrganizationContract.PaginatedOrganizations => !Array.isArray(arg);

export const orgsHandlers = {
  findMine: (orgs: ReadonlyArray<OrganizationContract.MyOrganization> = []) =>
    typedHandler(routes.findMine, () => ok(orgs)),

  create: (
    outcome:
      | { readonly result: "success"; readonly id?: OrganizationId }
      | { readonly result: "SuperAdminCannotOwnOrganizationError" } = { result: "success" },
  ) =>
    typedHandler(routes.create, () =>
      outcome.result === "SuperAdminCannotOwnOrganizationError"
        ? fail(OrganizationContract.SuperAdminCannotOwnOrganizationError, {
            message: "Super-admins cannot own organizations.",
          })
        : ok({ id: outcome.id ?? ORG_A_ID }),
    ),

  findAll: (
    arg:
      | ReadonlyArray<OrganizationContract.Organization>
      | OrganizationContract.PaginatedOrganizations = [],
  ) =>
    typedHandler(OrganizationContract.AdminGroup.routes.findAll, ({ urlParams }) =>
      ok(
        isPage(arg)
          ? arg
          : makePaginatedOrganizations({
              organizations: [...arg],
              page: urlParams.page,
              pageSize: urlParams.pageSize,
              total: arg.length,
            }),
      ),
    ),

  softDelete: (
    outcome: { readonly result: "success" | "OrganizationNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(routes.softDelete, () =>
      outcome.result === "success" ? ok(undefined) : notFound(),
    ),

  restore: (
    outcome: { readonly result: "success" | "OrganizationNotDeletedError" } = { result: "success" },
  ) =>
    typedHandler(routes.restore, () =>
      outcome.result === "success"
        ? ok(undefined)
        : fail(OrganizationContract.OrganizationNotDeletedError, {
            organizationId: ORG_A_ID,
            message: "Organization is not deleted.",
          }),
    ),

  findMembers: (members: ReadonlyArray<OrganizationContract.OrganizationMember> = []) =>
    typedHandler(routes.findMembers, () => ok({ members })),

  findInvitations: (invitations: ReadonlyArray<OrganizationContract.PendingInvitation> = []) =>
    typedHandler(routes.findInvitations, () => ok({ invitations })),

  removeMember: (
    outcome: { readonly result: "success" | "MembershipNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(routes.removeMember, () =>
      outcome.result === "success"
        ? ok(undefined)
        : fail(OrganizationContract.MembershipNotFoundError, { message: "Not a member." }),
    ),

  promoteMember: (
    outcome: { readonly result: "success" | "OrganizationRoleConflictError" } = {
      result: "success",
    },
  ) =>
    typedHandler(routes.promoteMember, () =>
      outcome.result === "success"
        ? ok(undefined)
        : fail(OrganizationContract.OrganizationRoleConflictError, {
            reason: "already_admin",
            message: "Already an admin.",
          }),
    ),

  demoteMember: (
    outcome: { readonly result: "success" | "OrganizationRoleConflictError" } = {
      result: "success",
    },
  ) =>
    typedHandler(routes.demoteMember, () =>
      outcome.result === "success"
        ? ok(undefined)
        : fail(OrganizationContract.OrganizationRoleConflictError, {
            reason: "not_admin",
            message: "Not an admin.",
          }),
    ),

  resendInvitation: (
    outcome: { readonly result: "success" | "InvitationGoneError" } = { result: "success" },
  ) =>
    typedHandler(routes.resendInvitation, () =>
      outcome.result === "success"
        ? ok(undefined)
        : fail(OrganizationContract.InvitationGoneError, {
            reason: "expired",
            message: "Invitation is closed.",
          }),
    ),

  revokeInvitation: (
    outcome: { readonly result: "success" | "InvitationNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(routes.revokeInvitation, () =>
      outcome.result === "success"
        ? ok(undefined)
        : fail(OrganizationContract.InvitationNotFoundError, { message: "Invitation not found." }),
    ),

  inviteUser: (
    outcome: { readonly result: "success" | "OrganizationNotFoundError" } = { result: "success" },
  ) =>
    typedHandler(routes.inviteUser, () =>
      outcome.result === "success"
        ? ok({ invitationId: makePendingInvitation().invitationId })
        : notFound(),
    ),
};
