import { Err, Ok, type Result } from "oxide.ts";

import { DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import type { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import type { DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";

export class DeviceGrantRepositoryFake extends DeviceGrantRepository {
  private readonly store = new Map<DeviceGrantId, DeviceGrantRoot>();

  public insertOne(grant: DeviceGrantRoot): Promise<Result<void, PersistenceUnavailable>> {
    this.store.set(grant.id, grant);
    return Promise.resolve(Ok(undefined));
  }

  public findOne(
    spec: Specification<DeviceGrantRoot>,
  ): Promise<Result<DeviceGrantRoot | null, PersistenceUnavailable>> {
    return Promise.resolve(Ok([...this.store.values()].find(spec) ?? null));
  }

  public updateOne(
    grant: DeviceGrantRoot,
  ): Promise<Result<void, DeviceGrantNotFound | PersistenceUnavailable>> {
    if (!this.store.has(grant.id)) return Promise.resolve(Err(new DeviceGrantNotFound({})));
    this.store.set(grant.id, grant);
    return Promise.resolve(Ok(undefined));
  }

  public deleteOne(
    id: DeviceGrantId,
  ): Promise<Result<void, DeviceGrantNotFound | PersistenceUnavailable>> {
    if (!this.store.delete(id)) return Promise.resolve(Err(new DeviceGrantNotFound({})));
    return Promise.resolve(Ok(undefined));
  }
}
