import { deepStrictEqual, rejects } from "node:assert";

import { describe, it } from "vitest";

import rowExists = require("./row-exists");

const bookshelfWith = (found: unknown) =>
  ({ model: () => ({ where: () => ({ fetch: async () => found }) }) }) as any;

describe("rowExists", () => {
  it("hands back the row, or the raw value when told not to convert", async () => {
    const row = { get: () => "x" };
    deepStrictEqual(await rowExists(bookshelfWith(row))("todo", "id")("id-1"), row);
    deepStrictEqual(
      await rowExists(bookshelfWith(row))("todo", "id", undefined, { convert: false })("id-1"),
      "id-1",
    );
  });

  it("answers a tagged 404 for a missing row, carrying the fields the route asked for", async () => {
    const validate = rowExists(bookshelfWith(null))("todo", "id", "Todo not found", {
      tag: "TodoNotFoundError",
      fields: (id: string) => ({ todoId: id }),
    });
    await rejects(validate("id-9"), (error: any) => {
      deepStrictEqual(error.output.statusCode, 404);
      deepStrictEqual(error.output.payload._tag, "TodoNotFoundError");
      deepStrictEqual(error.output.payload.todoId, "id-9");
      return true;
    });
  });

  it("raises a validation error instead when a 404 is not wanted", async () => {
    const validate = rowExists(bookshelfWith(null))("todo", "id", undefined, { return404: false });
    await rejects(validate("id-9"), (error: any) => {
      deepStrictEqual(error.name, "ValidationError");
      deepStrictEqual(error.message, "Row does not exist");
      return true;
    });
  });
});
