import { deepStrictEqual, throws } from "node:assert";

import { describe, it } from "vitest";

import { Spec } from "@/platform/ddd/contracts/specification.js";

import { criteriaToWhere } from "./criteria-to-sql.js";

type Row = { id: string; organizationId: string; deletedAt: string | null };
const columns = { id: "id", organizationId: "organization_id", deletedAt: "deleted_at" } as const;

describe("criteriaToWhere", () => {
  it("compiles Eq to a parameterised equality on the mapped column", () => {
    const fragment = criteriaToWhere(
      Spec.eq<Row, "organizationId">("organizationId", "o-1").criteria,
      columns,
    );
    deepStrictEqual(fragment.sql, '"organization_id" = $slonik_1');
    deepStrictEqual(fragment.values, ["o-1"]);
  });

  it("compiles And / Or / Not / IsNull compositions", () => {
    const spec = Spec.and(
      Spec.eq<Row, "id">("id", "a"),
      Spec.not(Spec.or(Spec.isNull<Row>("deletedAt"), Spec.isNotNull<Row>("deletedAt"))),
    );
    const fragment = criteriaToWhere(spec.criteria, columns);
    deepStrictEqual(
      fragment.sql,
      '("id" = $slonik_1 AND (NOT ("deleted_at" IS NULL OR "deleted_at" IS NOT NULL)))',
    );
    deepStrictEqual(fragment.values, ["a"]);
  });

  it("compiles an empty And to TRUE and an empty Or to FALSE", () => {
    deepStrictEqual(criteriaToWhere({ _tag: "And", nodes: [] }, columns).sql, "TRUE");
    deepStrictEqual(criteriaToWhere({ _tag: "Or", nodes: [] }, columns).sql, "FALSE");
  });

  it("refuses a field with no column mapping", () => {
    throws(
      () => criteriaToWhere({ _tag: "Eq", field: "nope", value: 1 }, columns),
      /no column mapping/,
    );
  });
});
