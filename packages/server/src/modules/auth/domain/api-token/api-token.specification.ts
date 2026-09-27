import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import type { UserId } from "@/platform/ids/user-id.js";

import type { ApiTokenId } from "./api-token.id.js";
import type { ApiTokenRoot } from "./api-token.root.js";

const withId = (id: ApiTokenId): Specification<ApiTokenRoot> =>
  Spec.eq<ApiTokenRoot, "id">("id", id);
const withHash = (tokenHash: string): Specification<ApiTokenRoot> =>
  Spec.eq<ApiTokenRoot, "tokenHash">("tokenHash", tokenHash);

const isActive = Spec.isNull<ApiTokenRoot>("revokedAt");
const forUser = (userId: UserId): Specification<ApiTokenRoot> =>
  Spec.and(Spec.eq<ApiTokenRoot, "userId">("userId", userId), isActive);

const isExpired = (token: ApiTokenRoot, now: Date): boolean =>
  token.expiresAt !== null && token.expiresAt.getTime() <= now.getTime();

export const ApiTokenSpecifications = { withId, withHash, forUser, isExpired } as const;
