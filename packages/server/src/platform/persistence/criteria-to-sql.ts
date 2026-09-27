import { type FragmentSqlToken, sql } from "@org/database";

import type { Criteria } from "@/platform/ddd/contracts/specification.js";

export type ColumnMap = Readonly<Record<string, string>>;

export const criteriaToWhere = (criteria: Criteria, columns: ColumnMap): FragmentSqlToken => {
  const column = (field: string): FragmentSqlToken => {
    const mapped = columns[field];
    if (mapped === undefined) {
      throw new Error(`criteriaToWhere: no column mapping for field "${field}"`);
    }
    return sql.fragment`${sql.identifier([mapped])}`;
  };

  const compile = (node: Criteria): FragmentSqlToken => {
    switch (node._tag) {
      case "And":
        return node.nodes.length === 0
          ? sql.fragment`TRUE`
          : sql.fragment`(${sql.join(node.nodes.map(compile), sql.fragment` AND `)})`;
      case "Or":
        return node.nodes.length === 0
          ? sql.fragment`FALSE`
          : sql.fragment`(${sql.join(node.nodes.map(compile), sql.fragment` OR `)})`;
      case "Not":
        return sql.fragment`(NOT ${compile(node.node)})`;
      case "IsNull":
        return sql.fragment`${column(node.field)} IS NULL`;
      case "IsNotNull":
        return sql.fragment`${column(node.field)} IS NOT NULL`;
      case "Eq":
        return sql.fragment`${column(node.field)} = ${node.value}`;
    }
  };

  return compile(criteria);
};
