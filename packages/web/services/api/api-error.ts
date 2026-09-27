// Every failed response, as one throwable. TanStack needs a thrown value to
// settle a query or mutation as an error, and the ViewModels switch on the
// wire's `_tag` to decide what to announce.

export type WireError = { readonly _tag: string; readonly message?: string } & Record<
  string,
  unknown
>;

export class ApiError extends Error {
  public readonly _tag: string;
  public readonly status: number;
  public readonly body: WireError;

  constructor(status: number, body: WireError) {
    super(body.message ?? body._tag);
    this.name = "ApiError";
    this._tag = body._tag;
    this.status = status;
    this.body = body;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

const isWireError = (value: unknown): value is WireError =>
  typeof value === "object" && value !== null && "_tag" in value && typeof value._tag === "string";

type Settled<A> = {
  readonly data?: A;
  readonly error?: unknown;
  readonly response: Response;
};

/** Unwraps an openapi-fetch response: the data, or a thrown `ApiError`. */
export const unwrap = <A>(settled: Settled<A>): A => {
  if (settled.error === undefined) return settled.data as A;
  const body: WireError = isWireError(settled.error)
    ? settled.error
    : { _tag: "InternalServerError", message: `HTTP ${settled.response.status}` };
  throw new ApiError(settled.response.status, body);
};
