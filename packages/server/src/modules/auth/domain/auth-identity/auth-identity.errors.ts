import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";

export class AuthIdentityNotFound extends TaggedError("AuthIdentityNotFound")<{
  readonly subject: string;
}> {}
export class IdentityMissingEmail extends TaggedError("IdentityMissingEmail")<{
  readonly subject: string;
}> {}
export class IdentityEmailAlreadyRegistered extends TaggedError("IdentityEmailAlreadyRegistered")<{
  readonly email: string;
}> {}
