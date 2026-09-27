import { Inject, Injectable } from "@nestjs/common";
import { RowSchemas, sql } from "@org/database";
import { Err, Ok, type Result } from "oxide.ts";

import { UserAlreadyExists, UserNotFound } from "@/modules/user/domain/user/user.errors.js";
import { UserRepository } from "@/modules/user/domain/user/user.repository.js";
import type { UserRoot } from "@/modules/user/domain/user/user.root.js";
import { Database } from "@/platform/database/database.js";
import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import type { Specification } from "@/platform/ddd/contracts/specification.js";
import type { UserId } from "@/platform/ids/user-id.js";
import { criteriaToWhere } from "@/platform/persistence/criteria-to-sql.js";
import { translateDatabaseErrors } from "@/platform/translate-database-errors.js";

import * as UserMapper from "./user.mapper.js";

@Injectable()
export class UserRepositoryLive extends UserRepository {
  constructor(@Inject(Database) private readonly db: Database) {
    super();
  }

  public insertOne(
    user: UserRoot,
  ): Promise<Result<void, UserAlreadyExists | PersistenceUnavailable>> {
    const row = UserMapper.toPersistence(user);
    return translateDatabaseErrors(
      async () => {
        await this.db.exec(sql.unsafe`
          INSERT INTO "user".users (id, email, country, street, postal_code, created_at, updated_at)
          VALUES (${row.id}, ${row.email}, ${row.country}, ${row.street}, ${row.postal_code},
                  ${sql.timestamp(row.created_at)}, ${sql.timestamp(row.updated_at)})
        `);
      },
      (error) =>
        error.type === "unique_violation" ? new UserAlreadyExists({ email: user.email }) : null,
    );
  }

  public async updateOne(
    user: UserRoot,
  ): Promise<Result<void, UserNotFound | PersistenceUnavailable>> {
    const row = UserMapper.toPersistence(user);
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`
        UPDATE "user".users SET
          email = ${row.email},
          country = ${row.country},
          street = ${row.street},
          postal_code = ${row.postal_code},
          updated_at = ${sql.timestamp(row.updated_at)}
        WHERE id = ${row.id}
      `),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new UserNotFound({ userId: user.id })) : Ok(undefined);
  }

  public async deleteOne(id: UserId): Promise<Result<void, UserNotFound | PersistenceUnavailable>> {
    const touched = await translateDatabaseErrors(() =>
      this.db.exec(sql.unsafe`DELETE FROM "user".users WHERE id = ${id}`),
    );
    if (touched.isErr()) return touched;
    return touched.unwrap() === 0 ? Err(new UserNotFound({ userId: id })) : Ok(undefined);
  }

  public findOne(
    spec: Specification<UserRoot>,
  ): Promise<Result<UserRoot | null, PersistenceUnavailable>> {
    return translateDatabaseErrors(async () => {
      const row = await this.db.maybeOne(sql.type(RowSchemas.UserRow)`
        SELECT * FROM "user".users
        WHERE ${criteriaToWhere(spec.criteria, UserMapper.columns)}
        LIMIT 1
      `);
      return row === null ? null : UserMapper.toDomain(row);
    });
  }
}
