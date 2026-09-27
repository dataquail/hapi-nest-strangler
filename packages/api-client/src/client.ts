import type { paths } from "@org/contracts";
import createClient, { type Client } from "openapi-fetch";

export type CliClient = Client<paths>;

/** The typed client over the generated contract; a token becomes `Authorization: Bearer`, the device endpoints need none. */
export const makeCliClient = (options: {
  readonly baseUrl: string;
  readonly token: string | null;
}): CliClient =>
  createClient<paths>({
    baseUrl: options.baseUrl,
    headers: options.token === null ? {} : { Authorization: `Bearer ${options.token}` },
  });
