import Boom from "@hapi/boom";

// The wire shape every client switches on is `{ _tag, message, ...fields }`.
// A Boom carries the tag and fields in `data`; the onPreResponse hook writes
// them into the payload, and a Boom without a tag gets the one for its status.
export const DEFAULT_TAGS: Record<number, string> = {
  400: "BadRequest",
  401: "Unauthorized",
  403: "Forbidden",
  404: "NotFound",
  409: "Conflict",
  410: "Gone",
  422: "UnprocessableEntity",
  500: "InternalServerError",
  502: "BadGateway",
  503: "ServiceUnavailable",
};

export const problem = (
  statusCode: number,
  tag: string,
  fields: Record<string, unknown> & { message?: string } = {},
): Boom.Boom => {
  const boom = new Boom.Boom(fields.message ?? tag, { statusCode });
  boom.data = { _tag: tag, fields };
  // Written twice on purpose: hapi's validation path keeps the payload but
  // not always `data`, and onPreResponse reads whichever survived.
  boom.output.payload = { ...boom.output.payload, _tag: tag, ...fields };
  return boom;
};

export const tagBoomPayload = (boom: Boom.Boom): void => {
  const data = boom.data as { _tag?: string; fields?: Record<string, unknown> } | null;
  const status = boom.output.statusCode;
  const payload = boom.output.payload as unknown as Record<string, unknown>;
  const tagged = typeof payload._tag === "string" ? payload._tag : undefined;
  const tag = data?._tag ?? tagged ?? DEFAULT_TAGS[status] ?? "HttpError";
  const message = status >= 500 && !data?._tag ? DEFAULT_TAGS[status] : payload.message;
  const { error: _error, statusCode: _statusCode, ...rest } = payload;
  boom.output.payload = { ...rest, _tag: tag, message, ...(data?.fields ?? {}) } as any;
};
