import type { Server } from "@hapi/hapi";
import type Bookshelf from "bookshelf";
import { randomBytes, randomUUID } from "crypto";
import type { Knex } from "knex";

import { domainEvents } from "../../constants/domain-events";
import type { BackendClient } from "../../lib/backend-client/create-backend-client";
import { isBackendClientError } from "../../lib/backend-client/http";
import * as logger from "../../lib/logger";
import { problem } from "../../lib/problem";
import type UserService = require("../user/user-service");

const ORG_ADMIN_ROLE = "admin";

type OrganizationRow = {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

type InvitationRow = {
  id: string;
  organization_id: string;
  invitee_email: string;
  token: string;
  expires_at: Date;
  accepted_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
};

const organizationNotFound = (organizationId: string) =>
  problem(404, "OrganizationNotFoundError", {
    organizationId,
    message: `Organization ${organizationId} not found`,
  });

const invitationGone = (reason: "accepted" | "revoked" | "expired", message: string) =>
  problem(410, "InvitationGoneError", { reason, message });

const toIso = (value: Date | null) => (value === null ? null : new Date(value).toISOString());

const toOrganizationJson = (row: OrganizationRow) => ({
  id: row.id,
  name: row.name,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
  deletedAt: toIso(row.deleted_at),
});

// Organizations, memberships, organization roles and invitations in one bag,
// with the HTTP problems thrown from here and the emails announced through
// the server's event bus once the transaction is out of the way.
class OrganizationService {
  public bookshelf: Bookshelf;
  public server: Server;
  public userService: UserService;
  public backendClient: BackendClient;

  constructor(
    bookshelf: Bookshelf,
    server: Server,
    userService: UserService,
    backendClient: BackendClient,
  ) {
    this.bookshelf = bookshelf;
    this.server = server;
    this.userService = userService;
    this.backendClient = backendClient;
  }

  // @types/bookshelf is typed against knex 0.21; the instance is knex 2.
  get knex(): Knex {
    return this.bookshelf.knex as unknown as Knex;
  }

  // The wallet lives on the other server, and it is opened from inside this
  // transaction: a refusal there rolls the organization back, and a failure
  // here after the wallet exists is undone by deleting it again, best effort.
  async createOrganization(name: string, actorUserId: string) {
    const id = randomUUID();
    const now = new Date();
    let walletOpened = false;
    try {
      await this.knex.transaction(async (t) => {
        await this.knex("organizations")
          .transacting(t)
          .insert({ id, name, created_at: now, updated_at: now, deleted_at: null });
        await this.knex("memberships")
          .transacting(t)
          .insert({ user_id: actorUserId, organization_id: id, created_at: now });
        await this.backendClient.wallets.create({ organizationId: id });
        walletOpened = true;
        await this.knex("organization_roles").transacting(t).insert({
          organization_id: id,
          user_id: actorUserId,
          role: ORG_ADMIN_ROLE,
          issued_by: actorUserId,
        });
      });
    } catch (error) {
      if (walletOpened) await this.compensateWallet(id);
      if (isBackendClientError(error)) {
        throw problem(502, "BadGateway", {
          message: `The wallet service refused to open a wallet for the new organization: ${error.message}`,
        });
      }
      throw error;
    }
    this.server.events.emit(domainEvents.ORGANIZATION_CREATED, { organizationId: id, name });
    return id;
  }

  async compensateWallet(organizationId: string) {
    try {
      await this.backendClient.wallets.remove(organizationId);
    } catch (error) {
      logger.error(`wallet compensation failed for organization ${organizationId}`, error);
    }
  }

  async softDelete(organization: any) {
    if (organization.isDeleted()) throw organizationNotFound(organization.get("id"));
    const now = new Date();
    await this.knex("organizations")
      .where({ id: organization.get("id") })
      .update({ deleted_at: now, updated_at: now });
  }

  async restore(organization: any) {
    if (!organization.isDeleted()) {
      throw problem(409, "OrganizationNotDeletedError", {
        organizationId: organization.get("id"),
        message: `Organization ${organization.get("id")} is not deleted`,
      });
    }
    const now = new Date();
    await this.knex("organizations")
      .where({ id: organization.get("id") })
      .update({ deleted_at: null, updated_at: now });
  }

  async findMine(userId: string) {
    const rows = await this.knex("memberships as m")
      .join("organizations as o", "o.id", "m.organization_id")
      .where("m.user_id", userId)
      .whereNull("o.deleted_at")
      .select(
        "o.*",
        this.knex.raw(
          `EXISTS (SELECT 1 FROM organization_roles r WHERE r.organization_id = o.id AND r.user_id = ? AND r.role = ?) AS is_admin`,
          [userId, ORG_ADMIN_ROLE],
        ),
      )
      .orderBy("o.created_at", "desc");
    return rows.map((row: OrganizationRow & { is_admin: boolean }) => ({
      ...toOrganizationJson(row),
      isAdmin: row.is_admin,
    }));
  }

  async findAll(page: number, pageSize: number, includeDeleted: boolean) {
    const scope = (qb: Knex.QueryBuilder) => (includeDeleted ? qb : qb.whereNull("deleted_at"));
    const rows: OrganizationRow[] = await scope(this.knex("organizations"))
      .select("*")
      .orderBy("created_at", "desc")
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const counted: any = await scope(this.knex("organizations")).count("* as count").first();
    return {
      organizations: rows.map(toOrganizationJson),
      page,
      pageSize,
      total: Number(counted?.count ?? 0),
    };
  }

  // An open invitation for the same address is reissued rather than duplicated.
  async inviteUser(organization: any, inviteeEmail: string, ttlSeconds: number) {
    const now = new Date();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const open: InvitationRow | undefined = await this.knex("invitations")
      .where({ organization_id: organization.get("id"), invitee_email: inviteeEmail })
      .whereNull("accepted_at")
      .whereNull("revoked_at")
      .orderBy("created_at", "desc")
      .first();
    if (open) {
      await this.knex("invitations")
        .where({ id: open.id })
        .update({ token, expires_at: expiresAt });
      this.server.events.emit(domainEvents.INVITATION_REISSUED, { invitationId: open.id });
      return open.id;
    }
    const id = randomUUID();
    await this.knex("invitations").insert({
      id,
      organization_id: organization.get("id"),
      invitee_email: inviteeEmail,
      token,
      expires_at: expiresAt,
      accepted_at: null,
      revoked_at: null,
      created_at: now,
    });
    this.server.events.emit(domainEvents.INVITATION_ISSUED, { invitationId: id });
    return id;
  }

  async findPendingInvitations(organization: any) {
    const now = Date.now();
    const rows: InvitationRow[] = await this.knex("invitations")
      .where({ organization_id: organization.get("id") })
      .whereNull("accepted_at")
      .whereNull("revoked_at")
      .orderBy("created_at", "desc");
    return rows.map((row) => ({
      invitationId: row.id,
      inviteeEmail: row.invitee_email,
      status: new Date(row.expires_at).getTime() <= now ? "expired" : "pending",
      expiresAt: new Date(row.expires_at).toISOString(),
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  async findInvitationInOrganization(
    organization: any,
    invitationId: string,
  ): Promise<InvitationRow> {
    const row: InvitationRow | undefined = await this.knex("invitations")
      .where({ id: invitationId, organization_id: organization.get("id") })
      .first();
    if (!row) throw problem(404, "InvitationNotFoundError", { message: "Invitation not found" });
    return row;
  }

  async revokeInvitation(organization: any, invitationId: string) {
    const invitation = await this.findInvitationInOrganization(organization, invitationId);
    if (invitation.accepted_at !== null) {
      throw invitationGone("accepted", "Invitation already accepted; use removeMember to undo.");
    }
    if (invitation.revoked_at !== null)
      throw invitationGone("revoked", "Invitation already revoked.");
    await this.knex("invitations")
      .where({ id: invitationId })
      .update({ accepted_at: null, revoked_at: new Date() });
  }

  async resendInvitation(organization: any, invitationId: string, ttlSeconds: number) {
    const invitation = await this.findInvitationInOrganization(organization, invitationId);
    if (invitation.accepted_at !== null)
      throw invitationGone("accepted", "Invitation already accepted.");
    if (invitation.revoked_at !== null)
      throw invitationGone("revoked", "Invitation already revoked.");
    const now = new Date();
    await this.knex("invitations")
      .where({ id: invitationId })
      .update({
        token: randomBytes(32).toString("base64url"),
        expires_at: new Date(now.getTime() + ttlSeconds * 1000),
        accepted_at: null,
        revoked_at: null,
      });
    this.server.events.emit(domainEvents.INVITATION_REISSUED, { invitationId });
  }

  // Accepting spans the invitation and a new membership, in one transaction.
  async acceptInvitation(token: string, user: any) {
    if (user.isSuperAdmin()) {
      throw problem(409, "SuperAdminCannotOwnOrganizationError", {
        message: "Super-admins don't join organizations.",
      });
    }
    const invitation: InvitationRow | undefined = await this.knex("invitations")
      .where({ token })
      .orderBy("created_at", "desc")
      .first();
    if (!invitation)
      throw problem(404, "InvitationNotFoundError", { message: "Invitation not found" });
    if (invitation.accepted_at !== null) {
      throw invitationGone("accepted", "This invitation has already been accepted.");
    }
    if (invitation.revoked_at !== null)
      throw invitationGone("revoked", "This invitation has been revoked.");
    const now = new Date();
    if (new Date(invitation.expires_at).getTime() <= now.getTime()) {
      throw invitationGone("expired", "This invitation has expired.");
    }
    await this.knex.transaction(async (t) => {
      await this.knex("invitations")
        .transacting(t)
        .where({ id: invitation.id })
        .update({ accepted_at: now, revoked_at: null });
      await this.knex("memberships")
        .transacting(t)
        .insert({
          user_id: user.get("id"),
          organization_id: invitation.organization_id,
          created_at: now,
        })
        .onConflict(["user_id", "organization_id"])
        .ignore();
    });
    return invitation.organization_id;
  }

  // Emails live on the users table: one JOIN, the way it has always been done here.
  async findMembers(organization: any) {
    const rows = await this.knex("memberships as m")
      .join("users as u", "u.id", "m.user_id")
      .leftJoin("organization_roles as r", function () {
        this.on("r.organization_id", "=", "m.organization_id")
          .andOn("r.user_id", "=", "m.user_id")
          .andOnVal("r.role", "=", ORG_ADMIN_ROLE);
      })
      .where("m.organization_id", organization.get("id"))
      .select(
        "m.user_id",
        "u.email",
        "m.created_at as joined_at",
        this.knex.raw("r.role IS NOT NULL AS is_admin"),
      )
      .orderBy("m.created_at", "asc");
    return rows.map((row: any) => ({
      userId: row.user_id,
      email: row.email,
      joinedAt: new Date(row.joined_at).toISOString(),
      isAdmin: Boolean(row.is_admin),
    }));
  }

  async removeMember(organization: any, targetUserId: string) {
    const deleted = await this.knex("memberships")
      .where({ user_id: targetUserId, organization_id: organization.get("id") })
      .del();
    if (deleted === 0) {
      throw problem(404, "MembershipNotFoundError", {
        message: "User is not a member of this organization",
      });
    }
  }

  async leave(organizationId: string, userId: string) {
    const deleted = await this.knex("memberships")
      .where({ user_id: userId, organization_id: organizationId })
      .del();
    if (deleted === 0) {
      throw problem(404, "MembershipNotFoundError", {
        message: "You aren't a member of this organization",
      });
    }
  }

  async promoteMember(organization: any, targetUserId: string, actorUserId: string) {
    if (targetUserId === actorUserId) {
      throw problem(403, "Forbidden", { message: "You cannot change your own role" });
    }
    const existing = await this.knex("organization_roles")
      .where({
        organization_id: organization.get("id"),
        user_id: targetUserId,
        role: ORG_ADMIN_ROLE,
      })
      .first();
    if (existing) {
      throw problem(409, "OrganizationRoleConflictError", {
        reason: "already_admin",
        message: "Member is already an admin of this organization",
      });
    }
    await this.knex("organization_roles").insert({
      organization_id: organization.get("id"),
      user_id: targetUserId,
      role: ORG_ADMIN_ROLE,
      issued_by: actorUserId,
    });
  }

  async demoteMember(organization: any, targetUserId: string) {
    const deleted = await this.knex("organization_roles")
      .where({
        organization_id: organization.get("id"),
        user_id: targetUserId,
        role: ORG_ADMIN_ROLE,
      })
      .del();
    if (deleted === 0) {
      throw problem(409, "OrganizationRoleConflictError", {
        reason: "not_admin",
        message: "Member is not an admin of this organization",
      });
    }
  }

  async findInvitationById(invitationId: string): Promise<InvitationRow | undefined> {
    return this.knex("invitations").where({ id: invitationId }).first();
  }
}

OrganizationService["@singleton"] = true;
OrganizationService["@require"] = [
  "bookshelf",
  "server",
  "user/user-service",
  "backend-client/index",
];

export = OrganizationService;
