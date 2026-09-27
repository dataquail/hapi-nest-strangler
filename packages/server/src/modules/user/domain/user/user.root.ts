import { z } from "zod";

import { UserId } from "@/platform/ids/user-id.js";

import { AddressValueObject } from "./value-objects/address.value-object.js";

export const UserRoot = z
  .object({
    id: UserId,
    email: z.string(),
    address: AddressValueObject.nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .readonly();
export type UserRoot = z.infer<typeof UserRoot>;
