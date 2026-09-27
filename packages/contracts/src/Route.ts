import type { z } from "zod";

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

/**
 * A wire error: a tagged object with a status. The tag is what a client
 * switches on and what the server's problem filter writes; the status is what
 * the OpenAPI document and the HTTP response carry.
 */
export type ErrorDefinition<
  Tag extends string = string,
  Shape extends z.ZodRawShape = z.ZodRawShape,
> = {
  readonly tag: Tag;
  readonly status: number;
  readonly schema: z.ZodObject<{ readonly _tag: z.ZodLiteral<Tag> } & Shape>;
  readonly description: string;
};

export type ErrorOf<D> =
  D extends ErrorDefinition<string, infer Shape>
    ? z.output<z.ZodObject<Shape>> & {
        readonly _tag: D extends ErrorDefinition<infer Tag> ? Tag : never;
      }
    : never;

export type Security = "session" | "public";

export type RouteInput = {
  readonly method: HttpMethod;
  /** OpenAPI-style path with `{param}` segments, including the group prefix. */
  readonly path: string;
  readonly operationId: string;
  readonly summary?: string;
  readonly params?: z.ZodObject;
  readonly query?: z.ZodObject;
  readonly body?: z.ZodType;
  readonly success: { readonly status: number; readonly schema: z.ZodType | undefined };
  readonly errors: ReadonlyArray<ErrorDefinition>;
  readonly security: Security;
};

export type RouteDefinition<R extends RouteInput = RouteInput> = R;

export type ParamsOf<R extends RouteInput> = R["params"] extends z.ZodObject
  ? z.output<R["params"]>
  : undefined;
export type QueryOf<R extends RouteInput> = R["query"] extends z.ZodObject
  ? z.output<R["query"]>
  : undefined;
export type BodyOf<R extends RouteInput> = R["body"] extends z.ZodType
  ? z.output<R["body"]>
  : undefined;
export type SuccessOf<R extends RouteInput> = R["success"]["schema"] extends z.ZodType
  ? z.output<R["success"]["schema"]>
  : void;

export const defineRoute = <const R extends RouteInput>(route: R): RouteDefinition<R> => route;

export type ContractGroup = {
  readonly name: string;
  readonly routes: Readonly<Record<string, RouteDefinition>>;
};

export const defineGroup = <const G extends ContractGroup>(group: G): G => group;

/** Converts an OpenAPI path (`/orgs/{orgId}`) to the Express shape Nest routes on (`/orgs/:orgId`). */
export const toExpressPath = (path: string): string => path.replace(/\{([^}]+)\}/g, ":$1");
