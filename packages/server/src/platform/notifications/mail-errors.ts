import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";

export class MailDeliveryError extends TaggedError("MailDeliveryError")<{
  readonly message: string;
}> {}
