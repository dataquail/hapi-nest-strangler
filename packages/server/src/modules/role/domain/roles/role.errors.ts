import { TaggedError } from "@/platform/ddd/contracts/tagged-error.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { RoleValueObject } from "./role.value-object.js";

export class AlreadyHasRole extends TaggedError("AlreadyHasRole")<{
  readonly userId: UserId;
  readonly role: RoleValueObject;
}> {}

export class DoesNotHaveRole extends TaggedError("DoesNotHaveRole")<{
  readonly userId: UserId;
  readonly role: RoleValueObject;
}> {}

export class CannotPromoteSelf extends TaggedError("CannotPromoteSelf")<{
  readonly userId: UserId;
}> {}
