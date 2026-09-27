import type Bookshelf from "bookshelf";

import { problem } from "../../problem";
import ValidationError = require("../ValidationError");

type Options = {
  convert?: boolean;
  return404?: boolean;
  tag?: string;
  fields?: (value: any) => Record<string, unknown>;
  fetchOptions?: Record<string, unknown>;
};

const rowExists =
  (bookshelf: Bookshelf) =>
  (modelName: string, column: string, message?: string, constraintOptions: Options = {}) =>
  async (value: any) => {
    const options: Required<Pick<Options, "convert" | "return404">> & Options = {
      convert: true,
      return404: true,
      fetchOptions: {},
      ...constraintOptions,
    };
    const model: any = await (bookshelf.model(modelName) as any)
      .where({ [column]: value })
      .fetch({ ...options.fetchOptions, require: false });
    if (!model) {
      if (options.return404) {
        throw problem(404, options.tag ?? "NotFound", {
          message: message || "Row does not exist",
          ...(options.fields ? options.fields(value) : {}),
        });
      }
      throw new ValidationError(message || "Row does not exist", "rowExists");
    }
    return options.convert ? model : value;
  };

rowExists["@require"] = ["bookshelf"];

export = rowExists;
