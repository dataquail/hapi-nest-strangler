import { z } from "zod";

export type Base = { readonly _tag: string };

export type SpanAttributeValue = string | number | boolean;

export type SpanAttributesExtractor<E extends Base> = (
  event: E,
) => Readonly<Record<string, SpanAttributeValue>>;

export type SpanAttributes = Readonly<Record<string, SpanAttributesExtractor<never>>>;

export type Definition<Tag extends string, Shape extends z.ZodRawShape> = {
  readonly tag: Tag;
  readonly schema: z.ZodReadonly<z.ZodObject<{ readonly _tag: z.ZodLiteral<Tag> } & Shape>>;
  readonly make: (
    payload: z.input<z.ZodObject<Shape>>,
  ) => { readonly _tag: Tag } & Readonly<z.output<z.ZodObject<Shape>>>;
  readonly is: (
    event: Base,
  ) => event is { readonly _tag: Tag } & Readonly<z.output<z.ZodObject<Shape>>>;
};

/** Any definition, structurally: what a subscription accepts. */
export type Any = {
  readonly tag: string;
  readonly make: (payload: never) => Base;
  readonly is: (event: Base) => boolean;
};

/** The event value a definition constructs. */
export type Type<D extends Any> = D extends { readonly make: (payload: never) => infer E }
  ? E
  : never;

export const make = <const Tag extends string, Shape extends z.ZodRawShape>(
  tag: Tag,
  shape: Shape,
): Definition<Tag, Shape> => {
  const schema = z.object({ _tag: z.literal(tag), ...shape }).readonly();
  type Value = { readonly _tag: Tag } & Readonly<z.output<z.ZodObject<Shape>>>;
  return {
    tag,
    schema,
    make: (payload) => schema.parse({ ...(payload as object), _tag: tag }) as Value,
    is: (event): event is Value => event._tag === tag,
  };
};
