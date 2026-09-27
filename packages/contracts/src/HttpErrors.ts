import { z } from "zod";

import type { ErrorDefinition } from "./Route.js";

export const defineError = <const Tag extends string, const Shape extends z.ZodRawShape>(
  tag: Tag,
  status: number,
  shape: Shape,
  description: string,
): ErrorDefinition<Tag, Shape> => ({
  tag,
  status,
  schema: z.object({ _tag: z.literal(tag), ...shape }),
  description,
});

const optionalMessage = { message: z.string().optional() };

export const BadRequest = defineError(
  "BadRequest",
  400,
  optionalMessage,
  "The request was invalid or cannot be otherwise served",
);
export const Unauthorized = defineError(
  "Unauthorized",
  401,
  optionalMessage,
  "Authentication is required and has failed or has not been provided",
);
export const Forbidden = defineError(
  "Forbidden",
  403,
  optionalMessage,
  "The server understood the request but refuses to authorize it",
);
export const NotFound = defineError(
  "NotFound",
  404,
  optionalMessage,
  "The requested resource could not be found",
);
export const Conflict = defineError(
  "Conflict",
  409,
  optionalMessage,
  "The resource already exists",
);
export const Gone = defineError(
  "Gone",
  410,
  optionalMessage,
  "The requested resource is no longer available and will not be available again",
);
export const UnprocessableEntity = defineError(
  "UnprocessableEntity",
  422,
  {
    message: z.string().optional(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  },
  "The request was well-formed but was unable to be followed due to semantic errors",
);
export const InternalServerError = defineError(
  "InternalServerError",
  500,
  optionalMessage,
  "The server has encountered a situation it doesn't know how to handle",
);
export const BadGateway = defineError(
  "BadGateway",
  502,
  optionalMessage,
  "The server, while acting as a gateway or proxy, received an invalid response from the upstream server",
);
export const ServiceUnavailable = defineError(
  "ServiceUnavailable",
  503,
  optionalMessage,
  "The server is not ready to handle the request",
);
