import {
  applyDecorators,
  Delete,
  Get,
  HttpCode,
  Patch,
  type PipeTransform,
  Post,
  Put,
} from "@nestjs/common";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { RouteDefinition } from "@org/contracts/Route";
import { toExpressPath } from "@org/contracts/Route";
import type { PersistenceUnavailable } from "@org/unit-of-work";
import type { Result } from "oxide.ts";
import type { z } from "zod";

import { HttpProblem, problem } from "./http-problem.js";

const methodDecorators = { get: Get, post: Post, put: Put, patch: Patch, delete: Delete } as const;

/**
 * Binds a controller method to a contract route: the HTTP method, the path and
 * the success status all come from the definition, so an endpoint cannot drift
 * from the OpenAPI document it implements.
 */
export const Endpoint = (route: RouteDefinition): MethodDecorator =>
  applyDecorators(
    methodDecorators[route.method](toExpressPath(route.path)),
    HttpCode(route.success.status),
  );

/** A validation pipe over a contract schema; a mismatch is a 400 BadRequest. */
export const zodPipe = <S extends z.ZodType>(schema: S): PipeTransform<unknown, z.output<S>> => ({
  transform: (value: unknown) => {
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
    throw problem(HttpErrors.BadRequest, {
      message: parsed.error.issues
        .map(
          (issue) =>
            `${issue.path.length === 0 ? "$" : issue.path.map(String).join(".")}: ${issue.message}`,
        )
        .join("; "),
    });
  },
});

type Tagged = { readonly _tag: string };

type ProblemMap<E extends Tagged> = {
  readonly [K in Exclude<E, HttpProblem>["_tag"]]: (
    error: Extract<E, { readonly _tag: K }>,
  ) => HttpProblem;
} & {
  /** Re-translates a resolver's generic NotFound into the route's own error; every other raised problem (a denial) passes through untouched. */
  readonly HttpProblem?: (error: HttpProblem<typeof HttpErrors.NotFound>) => HttpProblem;
};

/**
 * The endpoint's error translation, exhaustive by tag: every failure a use case
 * can return is mapped to a contract error here or the endpoint does not
 * compile. A problem already raised on the way (a denial, a resolver's
 * NotFound) passes through.
 */
export const unwrapOrThrow = <A, E extends Tagged>(
  result: Result<A, E>,
  toProblem: ProblemMap<E>,
): A => {
  if (result.isOk()) return result.unwrap();
  const error = result.unwrapErr();
  if (error instanceof HttpProblem) {
    const raised: HttpProblem = error;
    const isResolverMiss = raised.definition.tag === HttpErrors.NotFound.tag;
    throw isResolverMiss
      ? (toProblem.HttpProblem?.(raised as HttpProblem<typeof HttpErrors.NotFound>) ?? raised)
      : raised;
  }
  const translate = (toProblem as unknown as Record<string, (error: E) => HttpProblem>)[error._tag];
  if (translate === undefined) {
    throw new Error(`No HTTP translation for error tag "${error._tag}"`);
  }
  throw translate(error);
};

export const serviceUnavailable = (error: PersistenceUnavailable): HttpProblem =>
  problem(HttpErrors.ServiceUnavailable, { message: error.message });
