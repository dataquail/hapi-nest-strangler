import type { Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

import type { DeviceGrantNotFound } from "./device-grant.errors.js";
import type { DeviceGrantId } from "./device-grant.id.js";
import type { DeviceGrantRoot } from "./device-grant.root.js";

export abstract class DeviceGrantRepository {
  public abstract insertOne(grant: DeviceGrantRoot): Promise<Result<void, PersistenceUnavailable>>;
  public abstract findOne(
    spec: Specification<DeviceGrantRoot>,
  ): Promise<Result<DeviceGrantRoot | null, PersistenceUnavailable>>;
  public abstract updateOne(
    grant: DeviceGrantRoot,
  ): Promise<Result<void, DeviceGrantNotFound | PersistenceUnavailable>>;
  public abstract deleteOne(
    id: DeviceGrantId,
  ): Promise<Result<void, DeviceGrantNotFound | PersistenceUnavailable>>;
}
