import type { UserId } from "@/platform/ids/user-id.js";

import { UserAddressUpdated, UserCreated, UserDeleted, type UserEvent } from "./user.events.js";
import { UserRoot } from "./user.root.js";
import { AddressValueObject } from "./value-objects/address.value-object.js";

export type Outcome = {
  readonly user: UserRoot;
  readonly events: ReadonlyArray<UserEvent>;
};

export type CreateInput = {
  readonly id: UserId;
  readonly email: string;
  readonly address: AddressValueObject | null;
  readonly now: Date;
};

const create = (input: CreateInput): Outcome => {
  const user = UserRoot.parse({
    id: input.id,
    email: input.email,
    address: input.address,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    user,
    events: [UserCreated.make({ userId: user.id, email: user.email, address: user.address })],
  };
};

const markDeleted = (user: UserRoot): Outcome => ({
  user,
  events: [UserDeleted.make({ userId: user.id })],
});

export type UpdateAddressInput = {
  readonly country?: string;
  readonly postalCode?: string;
  readonly street?: string;
  readonly now: Date;
};

const updateAddress = (user: UserRoot, input: UpdateAddressInput): Outcome => {
  const newAddress = AddressValueObject.parse({
    country: input.country ?? user.address?.country ?? "",
    postalCode: input.postalCode ?? user.address?.postalCode ?? "",
    street: input.street ?? user.address?.street ?? "",
  });
  return {
    user: UserRoot.parse({
      id: user.id,
      email: user.email,
      address: newAddress,
      createdAt: user.createdAt,
      updatedAt: input.now,
    }),
    events: [
      UserAddressUpdated.make({
        userId: user.id,
        country: newAddress.country,
        postalCode: newAddress.postalCode,
        street: newAddress.street,
      }),
    ],
  };
};

export const UserRootOps = { create, markDeleted, updateAddress } as const;
