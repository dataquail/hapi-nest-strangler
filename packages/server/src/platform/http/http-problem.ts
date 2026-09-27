import { HttpException } from "@nestjs/common";
import type { ErrorDefinition } from "@org/contracts/Route";
import type { z } from "zod";

type BodyOf<D> =
  D extends ErrorDefinition<string, infer Shape>
    ? Omit<z.input<z.ZodObject<Shape>>, "_tag">
    : never;

/**
 * A contract error on its way to the wire: the definition supplies the tag and
 * the status, the body the fields. Thrown from an endpoint (or returned from a
 * resolver) and serialised by the problem filter.
 */
export class HttpProblem<
  D extends ErrorDefinition = ErrorDefinition<string, z.ZodRawShape>,
> extends HttpException {
  public readonly _tag = "HttpProblem" as const;
  public readonly definition: D;
  public readonly body: { readonly _tag: string } & Record<string, unknown>;

  /** `instanceof` on an unknown narrows to `HttpProblem<any>`; this keeps the definition typed. */
  public static is(value: unknown): value is HttpProblem {
    return value instanceof HttpProblem;
  }

  constructor(definition: D, body: BodyOf<D>) {
    const payload = { _tag: definition.tag, ...(body as object) };
    super(payload, definition.status);
    this.definition = definition;
    this.body = payload;
  }
}

export const problem = <D extends ErrorDefinition>(
  definition: D,
  body: BodyOf<D>,
): HttpProblem<D> => new HttpProblem(definition, body);
