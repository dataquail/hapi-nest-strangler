import { z } from "zod";

export const AddressValueObject = z
  .object({
    country: z.string().min(2).max(50),
    street: z.string().min(2).max(50),
    postalCode: z.string().min(2).max(10),
  })
  .readonly();
export type AddressValueObject = z.infer<typeof AddressValueObject>;
