// Contract-schema field validation, independent of any form library. Zod's
// issues reduce to the dotted-path error map a form renders.

import type { z } from "zod";

export type FieldErrors<Fields> = Partial<Record<keyof Fields & string, string>>;

export const validateWithSchema =
  <S extends z.ZodType>(schema: S) =>
  <I extends Record<string, unknown>>(input: I): FieldErrors<I> | null => {
    const result = schema.safeParse(input);
    if (result.success) return null;
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.map(String).join(".");
      errors[key] ??= issue.message;
    }
    return Object.keys(errors).length > 0 ? (errors as FieldErrors<I>) : null;
  };
