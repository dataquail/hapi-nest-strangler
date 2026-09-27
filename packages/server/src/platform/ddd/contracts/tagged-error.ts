/**
 * The shape every domain error takes: a `_tag` to switch on and the props that
 * describe the failure. Errors are values carried in `Err`, never thrown, so
 * this deliberately does not extend `Error`.
 *
 *   class TodoNotFound extends TaggedError("TodoNotFound")<{ readonly todoId: TodoId }> {}
 *   new TodoNotFound({ todoId })._tag === "TodoNotFound"
 */
export const TaggedError = <const Tag extends string>(tag: Tag) =>
  class Base {
    public readonly _tag: Tag = tag;
    constructor(props: object) {
      Object.assign(this, props);
    }
  } as new <Props extends object = Record<never, never>>(
    props: Props,
  ) => { readonly _tag: Tag } & Readonly<Props>;

export type TaggedErrorLike = { readonly _tag: string };
