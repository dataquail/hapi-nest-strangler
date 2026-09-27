// Every authenticated user carries USER; the others are granted rows in the
// roles table (platform) or organization_roles (per org, resolved per request).
export const USER = "user";
export const SUPER_ADMIN = "super_admin";
export const ORG_ADMIN = "org_admin";
export const ORG_MEMBER = "org_member";

export const roleConstants = { USER, SUPER_ADMIN, ORG_ADMIN, ORG_MEMBER } as const;
