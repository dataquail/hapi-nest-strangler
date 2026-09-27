import type Bookshelf from "bookshelf";
import { randomUUID } from "crypto";
import type { Knex } from "knex";

import { roleConstants } from "../../constants/acl/role-constants";
import { problem } from "../../lib/problem";

type CreateUserPayload = {
  email: string;
  country?: string;
  street?: string;
  postalCode?: string;
};

type UserRow = {
  id: string;
  email: string;
  country: string | null;
  street: string | null;
  postal_code: string | null;
  created_at: Date;
  updated_at: Date;
};

const UNIQUE_VIOLATION = "23505";

const toJson = (row: UserRow) => ({
  id: row.id,
  email: row.email,
  address:
    row.country !== null && row.street !== null && row.postal_code !== null
      ? { country: row.country, street: row.street, postalCode: row.postal_code }
      : null,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

class UserService {
  public bookshelf: Bookshelf;

  constructor(bookshelf: Bookshelf) {
    this.bookshelf = bookshelf;
  }

  // @types/bookshelf is typed against knex 0.21; the instance is knex 2.
  get knex(): Knex {
    return this.bookshelf.knex as unknown as Knex;
  }

  async createUser(payload: CreateUserPayload, transacting?: Knex.Transaction) {
    const now = new Date();
    const id = randomUUID();
    const hasAddress =
      payload.country !== undefined &&
      payload.street !== undefined &&
      payload.postalCode !== undefined;
    const query = this.knex("users").insert({
      id,
      email: payload.email,
      country: hasAddress ? payload.country : null,
      street: hasAddress ? payload.street : null,
      postal_code: hasAddress ? payload.postalCode : null,
      created_at: now,
      updated_at: now,
    });
    try {
      await (transacting ? query.transacting(transacting) : query);
    } catch (error: any) {
      if (error?.code === UNIQUE_VIOLATION) {
        throw problem(409, "UserAlreadyExistsError", {
          email: payload.email,
          message: `A user with email ${payload.email} already exists`,
        });
      }
      throw error;
    }
    return id;
  }

  async findUsers(page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const rows: UserRow[] = await this.knex("users")
      .select("*")
      .orderBy("created_at", "desc")
      .limit(pageSize)
      .offset(offset);
    const counted: any = await this.knex("users").count("* as count").first();
    return { users: rows.map(toJson), page, pageSize, total: Number(counted?.count ?? 0) };
  }

  async deleteUser(user: any) {
    const deleted = await this.knex("users")
      .where({ id: user.get("id") })
      .del();
    if (deleted === 0) {
      throw problem(404, "UserNotFoundError", {
        userId: user.get("id"),
        message: `User ${user.get("id")} not found`,
      });
    }
  }

  fetchUserWithRoles(userId: string) {
    return (this.bookshelf.model("user") as any)
      .where({ id: userId })
      .fetch({ require: false, withRelated: ["roles", "memberships", "organizationRoles"] });
  }

  async isSuperAdmin(userId: string): Promise<boolean> {
    const row: any = await this.knex("roles")
      .where({ user_id: userId, role: roleConstants.SUPER_ADMIN })
      .first();
    return Boolean(row);
  }

  async grantRole(userId: string, role: string, transacting?: Knex.Transaction) {
    const query = this.knex("roles")
      .insert({ user_id: userId, role })
      .onConflict(["user_id", "role"])
      .ignore();
    await (transacting ? query.transacting(transacting) : query);
  }
}

UserService["@singleton"] = true;
UserService["@require"] = ["bookshelf"];

export = UserService;
