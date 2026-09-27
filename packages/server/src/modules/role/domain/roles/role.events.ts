import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";
import { UserId } from "@/platform/ids/user-id.js";

import { RoleValueObject } from "./role.value-object.js";

export const RoleGranted = Event.make("RoleGranted", { userId: UserId, role: RoleValueObject });
export type RoleGranted = Event.Type<typeof RoleGranted>;

export const roleGrantedSpanAttributes: SpanAttributesExtractor<RoleGranted> = (event) => ({
  "user.id": event.userId,
  "role.name": event.role,
});

export const RoleRevoked = Event.make("RoleRevoked", { userId: UserId, role: RoleValueObject });
export type RoleRevoked = Event.Type<typeof RoleRevoked>;

export const roleRevokedSpanAttributes: SpanAttributesExtractor<RoleRevoked> = (event) => ({
  "user.id": event.userId,
  "role.name": event.role,
});

export type RoleEvent = RoleGranted | RoleRevoked;
