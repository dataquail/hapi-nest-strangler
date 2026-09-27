export type Criteria =
  | { readonly _tag: "And"; readonly nodes: ReadonlyArray<Criteria> }
  | { readonly _tag: "Or"; readonly nodes: ReadonlyArray<Criteria> }
  | { readonly _tag: "Not"; readonly node: Criteria }
  | { readonly _tag: "IsNull"; readonly field: string }
  | { readonly _tag: "IsNotNull"; readonly field: string }
  | { readonly _tag: "Eq"; readonly field: string; readonly value: string | number | boolean };

export type Predicate<T> = (candidate: T) => boolean;

/** A domain predicate that also carries the criteria a repository compiles into a filter. */
export type Specification<T> = Predicate<T> & {
  readonly criteria: Criteria;
};

const make = <T>(predicate: Predicate<T>, criteria: Criteria): Specification<T> =>
  Object.assign(predicate, { criteria });

const readField = (candidate: unknown, field: string): unknown =>
  (candidate as Record<string, unknown>)[field];

const isNull = <T>(field: keyof T & string): Specification<T> =>
  make<T>((candidate) => readField(candidate, field) === null, { _tag: "IsNull", field });

const isNotNull = <T>(field: keyof T & string): Specification<T> =>
  make<T>((candidate) => readField(candidate, field) !== null, { _tag: "IsNotNull", field });

const eq = <T, K extends keyof T & string>(
  field: K,
  value: Extract<T[K], string | number | boolean>,
): Specification<T> =>
  make<T>((candidate) => readField(candidate, field) === value, { _tag: "Eq", field, value });

const and = <T>(...specs: ReadonlyArray<Specification<T>>): Specification<T> =>
  make<T>((candidate) => specs.every((spec) => spec(candidate)), {
    _tag: "And",
    nodes: specs.map((spec) => spec.criteria),
  });

const or = <T>(...specs: ReadonlyArray<Specification<T>>): Specification<T> =>
  make<T>((candidate) => specs.some((spec) => spec(candidate)), {
    _tag: "Or",
    nodes: specs.map((spec) => spec.criteria),
  });

const not = <T>(spec: Specification<T>): Specification<T> =>
  make<T>((candidate) => !spec(candidate), { _tag: "Not", node: spec.criteria });

export const Spec = { isNull, isNotNull, eq, and, or, not } as const;
