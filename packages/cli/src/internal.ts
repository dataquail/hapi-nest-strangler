import { spawn } from "node:child_process";

import {
  type CliClient,
  makeCliClient,
  readCredentials,
  resolveBaseUrl,
  resolveToken,
} from "@org/api-client";

/** The CLI's one user-facing failure: the entrypoint prints its message and exits non-zero. */
export class CliError extends Error {
  public readonly _tag = "CliError";
}

export const authedClient = async (): Promise<CliClient> => {
  const token = resolveToken(await readCredentials());
  if (token === null)
    throw new CliError("Not authenticated. Run `org auth login`, or set APP_API_TOKEN.");
  return makeCliClient({ baseUrl: resolveBaseUrl(), token });
};

export const resolveOrg = async (explicit: string | undefined): Promise<string> => {
  if (explicit !== undefined) return explicit;
  const { defaultOrgId } = await readCredentials();
  if (defaultOrgId !== undefined) return defaultOrgId;
  throw new CliError("No organization selected. Pass --org <id> or run `org config set-org <id>`.");
};

// Best effort, and skipped in headless contexts: the URL is printed too.
export const openBrowser = (url: string): void => {
  if (process.env.NO_BROWSER === "1" || (process.env.CI ?? "") !== "") return;
  try {
    const opener =
      process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
    const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
    spawn(opener, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    return;
  }
};

export const maskToken = (token: string): string =>
  token.length <= 16 ? `${token.slice(0, 4)}…` : `${token.slice(0, 12)}…${token.slice(-4)}`;

type WireError = { readonly _tag?: unknown; readonly message?: unknown };

/** Every failed response or transport error becomes one friendly message. */
export const toCliError = (error: unknown): CliError => {
  if (error instanceof CliError) return error;
  const wire = (typeof error === "object" && error !== null ? error : {}) as WireError;
  const tag = typeof wire._tag === "string" ? wire._tag : "";
  const message = typeof wire.message === "string" ? wire.message : "";
  switch (tag) {
    case "Unauthorized":
      return new CliError(
        "Not authorized — your token may be invalid or expired. Run `org auth login`.",
      );
    case "Forbidden":
      return new CliError("You don't have access to that organization or resource.");
    case "ServiceUnavailable":
      return new CliError("The server is temporarily unavailable. Try again shortly.");
    case "CliTodoNotFoundError":
      return new CliError(message.length > 0 ? message : "Todo not found.");
    case "DeviceTokenExpired":
      return new CliError("The device code expired before approval. Run `org auth login` again.");
    case "DeviceCodeNotFound":
      return new CliError("That device code is invalid. Run `org auth login` again.");
    default:
      if (error instanceof TypeError)
        return new CliError(`Could not reach the server at ${resolveBaseUrl()}.`);
      return new CliError(tag.length > 0 ? `Request failed (${tag}).` : String(error));
  }
};

/** Unwraps an openapi-fetch response: data on success, `CliError` otherwise. */
export const expect = <T>(response: { readonly data?: T; readonly error?: unknown }): T => {
  if (response.error !== undefined) throw toCliError(response.error);
  return response.data as T;
};

/** Wraps a command body so every failure, wire or local, exits through `CliError`. */
export const run =
  <A extends ReadonlyArray<unknown>>(body: (...args: A) => Promise<void>) =>
  async (...args: A): Promise<void> => {
    try {
      await body(...args);
    } catch (error) {
      throw toCliError(error);
    }
  };
