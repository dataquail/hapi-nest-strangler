import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { UserRoot } from "./user.root.js";

const withId = (id: UserId): Specification<UserRoot> => Spec.eq<UserRoot, "id">("id", id);

const withEmail = (email: string): Specification<UserRoot> =>
  Spec.eq<UserRoot, "email">("email", email);

export const UserSpecifications = { withId, withEmail } as const;
