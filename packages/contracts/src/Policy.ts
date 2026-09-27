import type { UserId } from "./EntityIds.js";

/**
 * The per-request identity every private endpoint sees: session id plus user
 * id, nothing else. Authorization-relevant state (platform roles, org
 * memberships) lives behind module-owned ACL ports consumed by policies, not on
 * this value.
 */
export type CurrentUser = {
  readonly sessionId: string;
  readonly userId: UserId;
};

/** The header and cookie names the session middleware speaks. */
export const AUTHORIZATION_HEADER = "authorization";
