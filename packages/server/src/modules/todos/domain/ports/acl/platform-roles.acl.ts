import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { UserId } from "@/platform/ids/user-id.js";

export abstract class PlatformRoles {
  public abstract isSuperAdmin(userId: UserId): Promise<Result<boolean, PersistenceUnavailable>>;
}
