import type { MessageSpanAttributes } from "@/platform/cqrs/command-bus.js";

import { AcceptInvitationCommand } from "./commands/accept-invitation.command.js";
import { AcceptInvitationHandler } from "./commands/accept-invitation.handler.js";
import { CreateOrganizationCommand } from "./commands/create-organization.command.js";
import { CreateOrganizationHandler } from "./commands/create-organization.handler.js";
import { GrantOrganizationRoleCommand } from "./commands/grant-organization-role.command.js";
import { GrantOrganizationRoleHandler } from "./commands/grant-organization-role.handler.js";
import { InviteUserCommand } from "./commands/invite-user.command.js";
import { InviteUserHandler } from "./commands/invite-user.handler.js";
import { LeaveOrganizationCommand } from "./commands/leave-organization.command.js";
import { LeaveOrganizationHandler } from "./commands/leave-organization.handler.js";
import { RemoveMemberCommand } from "./commands/remove-member.command.js";
import { RemoveMemberHandler } from "./commands/remove-member.handler.js";
import { ResendInvitationCommand } from "./commands/resend-invitation.command.js";
import { ResendInvitationHandler } from "./commands/resend-invitation.handler.js";
import { RestoreOrganizationCommand } from "./commands/restore-organization.command.js";
import { RestoreOrganizationHandler } from "./commands/restore-organization.handler.js";
import { RevokeInvitationCommand } from "./commands/revoke-invitation.command.js";
import { RevokeInvitationHandler } from "./commands/revoke-invitation.handler.js";
import { RevokeOrganizationRoleCommand } from "./commands/revoke-organization-role.command.js";
import { RevokeOrganizationRoleHandler } from "./commands/revoke-organization-role.handler.js";
import { SendInvitationEmailCommand } from "./commands/send-invitation-email.command.js";
import { SendInvitationEmailHandler } from "./commands/send-invitation-email.handler.js";
import { SoftDeleteOrganizationCommand } from "./commands/soft-delete-organization.command.js";
import { SoftDeleteOrganizationHandler } from "./commands/soft-delete-organization.handler.js";

export const organizationCommands = [
  CreateOrganizationCommand,
  AcceptInvitationCommand,
  InviteUserCommand,
  ResendInvitationCommand,
  RevokeInvitationCommand,
  GrantOrganizationRoleCommand,
  RevokeOrganizationRoleCommand,
  LeaveOrganizationCommand,
  RemoveMemberCommand,
  RestoreOrganizationCommand,
  SoftDeleteOrganizationCommand,
  SendInvitationEmailCommand,
] as const;

export const organizationCommandHandlers = [
  CreateOrganizationHandler,
  AcceptInvitationHandler,
  InviteUserHandler,
  ResendInvitationHandler,
  RevokeInvitationHandler,
  GrantOrganizationRoleHandler,
  RevokeOrganizationRoleHandler,
  LeaveOrganizationHandler,
  RemoveMemberHandler,
  RestoreOrganizationHandler,
  SoftDeleteOrganizationHandler,
  SendInvitationEmailHandler,
] as const;

export const organizationCommandSpanAttributes: MessageSpanAttributes = {
  CreateOrganizationCommand: ({ payload }: CreateOrganizationCommand) => ({
    "organization.name": payload.name,
    "actor.user.id": payload.actorUserId,
  }),
  AcceptInvitationCommand: ({ payload }: AcceptInvitationCommand) => ({
    "user.id": payload.userId,
  }),
  InviteUserCommand: ({ payload }: InviteUserCommand) => ({
    "organization.id": payload.organizationId,
    "actor.user.id": payload.actorUserId,
  }),
  ResendInvitationCommand: ({ payload }: ResendInvitationCommand) => ({
    "invitation.id": payload.invitationId,
    "actor.user.id": payload.actorUserId,
  }),
  RevokeInvitationCommand: ({ payload }: RevokeInvitationCommand) => ({
    "invitation.id": payload.invitationId,
    "actor.user.id": payload.actorUserId,
  }),
  GrantOrganizationRoleCommand: ({ payload }: GrantOrganizationRoleCommand) => ({
    "user.id": payload.userId,
    "organization.id": payload.organizationId,
    "organization.role": payload.role,
    "actor.user.id": payload.actorUserId,
  }),
  RevokeOrganizationRoleCommand: ({ payload }: RevokeOrganizationRoleCommand) => ({
    "user.id": payload.userId,
    "organization.id": payload.organizationId,
    "organization.role": payload.role,
  }),
  LeaveOrganizationCommand: ({ payload }: LeaveOrganizationCommand) => ({
    "user.id": payload.userId,
    "organization.id": payload.organizationId,
  }),
  RemoveMemberCommand: ({ payload }: RemoveMemberCommand) => ({
    "target.user.id": payload.targetUserId,
    "organization.id": payload.organizationId,
    "actor.user.id": payload.actorUserId,
  }),
  RestoreOrganizationCommand: ({ payload }: RestoreOrganizationCommand) => ({
    "organization.id": payload.organizationId,
  }),
  SoftDeleteOrganizationCommand: ({ payload }: SoftDeleteOrganizationCommand) => ({
    "organization.id": payload.organizationId,
  }),
  SendInvitationEmailCommand: ({ payload }: SendInvitationEmailCommand) => ({
    "invitation.id": payload.invitationId,
  }),
};
