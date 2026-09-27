import type { SpanAttributes } from "@/platform/ddd/contracts/domain-event.js";

import {
  userAddressUpdatedSpanAttributes,
  userCreatedSpanAttributes,
  userDeletedSpanAttributes,
} from "./domain/user/user.events.js";

export const userEventSpanAttributes: SpanAttributes = {
  UserCreated: userCreatedSpanAttributes,
  UserDeleted: userDeletedSpanAttributes,
  UserAddressUpdated: userAddressUpdatedSpanAttributes,
};
