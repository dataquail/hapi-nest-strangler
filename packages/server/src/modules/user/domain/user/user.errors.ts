import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { UserId } from "@/platform/ids/user-id.js";

export class UserAlreadyExists extends TaggedError("UserAlreadyExists")<{
  readonly email: string;
}> {}

export class UserNotFound extends TaggedError("UserNotFound")<{ readonly userId: UserId }> {}
