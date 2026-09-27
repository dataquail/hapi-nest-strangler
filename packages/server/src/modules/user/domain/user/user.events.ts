import { z } from "zod";

import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";
import { UserId } from "@/platform/ids/user-id.js";

import { AddressValueObject } from "./value-objects/address.value-object.js";

export const UserCreated = Event.make("UserCreated", {
  userId: UserId,
  email: z.string(),
  address: AddressValueObject.nullable(),
});
export type UserCreated = Event.Type<typeof UserCreated>;

export const userCreatedSpanAttributes: SpanAttributesExtractor<UserCreated> = (event) => ({
  "user.id": event.userId,
});

export const UserDeleted = Event.make("UserDeleted", { userId: UserId });
export type UserDeleted = Event.Type<typeof UserDeleted>;

export const userDeletedSpanAttributes: SpanAttributesExtractor<UserDeleted> = (event) => ({
  "user.id": event.userId,
});

export const UserAddressUpdated = Event.make("UserAddressUpdated", {
  userId: UserId,
  country: z.string(),
  street: z.string(),
  postalCode: z.string(),
});
export type UserAddressUpdated = Event.Type<typeof UserAddressUpdated>;

export const userAddressUpdatedSpanAttributes: SpanAttributesExtractor<UserAddressUpdated> = (
  event,
) => ({ "user.id": event.userId });

export type UserEvent = UserCreated | UserDeleted | UserAddressUpdated;
