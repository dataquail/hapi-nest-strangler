export class BackendClientError extends Error {
  public status: number | null;
  public body: unknown;

  constructor(message: string, status: number | null, body?: unknown) {
    super(message);
    this.name = "BackendClientError";
    this.status = status;
    this.body = body;
  }
}

// Checked by name rather than instanceof: the class may be loaded twice when
// a test's module graph and the container's do not share instances.
const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const isBackendClientError = (error: unknown): error is BackendClientError =>
  typeof error === "object" &&
  error !== null &&
  (error as { name?: unknown }).name === "BackendClientError";

export type HttpClient = {
  get(path: string): Promise<unknown>;
  post(path: string, body: unknown): Promise<unknown>;
  delete(path: string): Promise<unknown>;
};

type Options = { baseUrl: string; authenticate: () => Promise<string> };

// A thin fetch wrapper: every call carries the inter-service token, a
// non-2xx answer is a BackendClientError with the status and body, and a
// network failure is one with no status.
export const createHttpClient = ({ authenticate, baseUrl }: Options): HttpClient => {
  const request = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const token = await authenticate();
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new BackendClientError(`${method} ${path} failed: ${String(error)}`, null);
    }
    const text = await response.text();
    const parsed: unknown = text === "" ? undefined : safeJson(text);
    if (!response.ok) {
      throw new BackendClientError(
        `${method} ${path} answered ${response.status}`,
        response.status,
        parsed,
      );
    }
    return parsed;
  };
  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    delete: (path) => request("DELETE", path),
  };
};
