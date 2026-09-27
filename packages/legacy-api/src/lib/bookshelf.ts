import Bookshelf from "bookshelf";
import type { Knex } from "knex";

import { models } from "../application/models";

const bookshelfFactory = (knex: Knex) => {
  // @types/bookshelf is typed against knex 0.21; the runtime pairing is the reference's.
  const bookshelf = Bookshelf(knex as any);
  models.forEach((modelInfo) => {
    bookshelf.model(modelInfo.name, modelInfo.model(bookshelf));
  });
  return bookshelf;
};
bookshelfFactory["@singleton"] = true;
bookshelfFactory["@require"] = ["knex"];

export = bookshelfFactory;
