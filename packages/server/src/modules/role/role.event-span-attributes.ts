import type { SpanAttributes } from "@/platform/ddd/contracts/domain-event.js";

import {
  roleGrantedSpanAttributes,
  roleRevokedSpanAttributes,
} from "./domain/roles/role.events.js";

export const roleEventSpanAttributes: SpanAttributes = {
  RoleGranted: roleGrantedSpanAttributes,
  RoleRevoked: roleRevokedSpanAttributes,
};
