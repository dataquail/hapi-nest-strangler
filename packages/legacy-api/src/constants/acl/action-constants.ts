export const actionConstants = {
  VIEW: "view",
  EDIT: "edit",
  CREATE: "create",
  DELETE: "delete",
  LIST: "list",

  // Specialty Actions
  LIST_ADMIN: "list_admin",
  RESTORE: "restore",
  INVITE: "invite",
  REVOKE_INVITE: "revoke_invite",
  RESEND_INVITE: "resend_invite",
  PROMOTE: "promote",
  DEMOTE: "demote",
  REMOVE_MEMBER: "remove_member",
  LEAVE: "leave",
  MANAGE_BILLING: "manage_billing",
  APPROVE: "approve",
} as const;
