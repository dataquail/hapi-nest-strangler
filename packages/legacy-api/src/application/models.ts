import type Bookshelf from "bookshelf";

export type ModelFactory = (bookshelf: Bookshelf) => Bookshelf.Model<any> | Record<string, unknown>;

// The bookshelf registry: every model, by the string name the rest of the
// application uses to reach it (`bookshelf.model("user")`).
export const models: Array<{ name: string; model: ModelFactory }> = [];
