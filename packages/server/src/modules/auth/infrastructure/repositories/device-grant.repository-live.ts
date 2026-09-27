import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok, type Result } from "oxide.ts";

import { DeviceGrantNotFound } from "@/modules/auth/domain/device-grant/device-grant.errors.js";
import type { DeviceGrantId } from "@/modules/auth/domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "@/modules/auth/domain/device-grant/device-grant.repository.js";
import type { DeviceGrantRoot } from "@/modules/auth/domain/device-grant/device-grant.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as DeviceGrantMapper from "./device-grant.mapper.js";

const timestampOrNull = (value: Date | null) => (value === null ? null : sql.timestamp(value));

@Injectable()
export class DeviceGrantRepositoryLive extends DeviceGrantRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(grant: DeviceGrantRoot): Promise<Result<void, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      await this.db.exec(sql.unsafe`
        INSERT INTO auth.device_grants
          (id, device_code_hash, user_code, status, user_id, created_at, expires_at, approved_at)
        VALUES (${grant.id}, ${grant.deviceCodeHash}, ${grant.userCode}, ${grant.status}, ${grant.userId},
                ${sql.timestamp(grant.createdAt)}, ${sql.timestamp(grant.expiresAt)}, ${timestampOrNull(grant.approvedAt)})
      `);
    });
  }

  public findOne(
    spec: Specification<DeviceGrantRoot>,
  ): Promise<Result<DeviceGrantRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.DeviceGrantRow)`
        SELECT * FROM auth.device_grants
        WHERE ${criteriaToWhere(spec.criteria, DeviceGrantMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : DeviceGrantMapper.toDomain(row);
    });
  }

  public async updateOne(
    grant: DeviceGrantRoot,
  ): Promise<Result<void, DeviceGrantNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        UPDATE auth.device_grants
        SET status = ${grant.status}, user_id = ${grant.userId}, approved_at = ${timestampOrNull(grant.approvedAt)}
        WHERE id = ${grant.id}
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new DeviceGrantNotFound({})) : Ok(undefined);
  }

  public async deleteOne(
    id: DeviceGrantId,
  ): Promise<Result<void, DeviceGrantNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`DELETE FROM auth.device_grants WHERE id = ${id}`),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new DeviceGrantNotFound({})) : Ok(undefined);
  }
}
