import {
  clearToken,
  makeCliClient,
  readCredentials,
  resolveBaseUrl,
  resolveToken,
  saveToken,
} from "@org/api-client";
import { Command } from "commander";

import { CliError, expect, maskToken, openBrowser, run } from "../internal.js";

const sleep = (seconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const validate = async (token: string): Promise<void> => {
  expect(await makeCliClient({ baseUrl: resolveBaseUrl(), token }).GET("/cli/orgs"));
};

// `auth login [--with-token <pat>]`: store and validate a pasted token, or run
// the device flow: print and open the verification URL, then poll until the
// browser approves, bounded by the grant's own lifetime.
const login = new Command("login")
  .option(
    "--with-token <token>",
    "Store a pre-minted personal access token instead of the device flow",
  )
  .action(
    run(async ({ withToken }: { readonly withToken?: string }) => {
      if (withToken !== undefined) {
        await validate(withToken);
        await saveToken(withToken);
        console.log("✓ Token stored and verified.");
        return;
      }
      const client = makeCliClient({ baseUrl: resolveBaseUrl(), token: null });
      const start = expect(await client.POST("/cli/device/start"));
      console.log(
        [
          "",
          "To sign in, open this URL in your browser:",
          "",
          `  ${start.verification_uri_complete}`,
          "",
          `and confirm the code:  ${start.user_code}`,
          "",
          "Waiting for approval…",
        ].join("\n"),
      );
      openBrowser(start.verification_uri_complete);
      const deadline = Date.now() + (start.expires_in + 5) * 1000;
      while (Date.now() < deadline) {
        const poll = await client.POST("/cli/device/token", {
          body: { device_code: start.device_code },
        });
        if (poll.data !== undefined) {
          await saveToken(poll.data.access_token);
          console.log("✓ Authenticated! You're signed in.");
          return;
        }
        if (poll.error._tag !== "DeviceAuthorizationPending") expect(poll);
        await sleep(start.interval);
      }
      throw new CliError("Timed out waiting for device approval. Try again.");
    }),
  );

const status = new Command("status").action(
  run(async () => {
    const token = resolveToken(await readCredentials());
    if (token === null) {
      console.log("Not authenticated. Run `org auth login`.");
      return;
    }
    const response = await makeCliClient({ baseUrl: resolveBaseUrl(), token }).GET("/cli/orgs");
    if (response.error?._tag === "Unauthorized") {
      console.log("Token is invalid or expired. Run `org auth login`.");
      return;
    }
    expect(response);
    console.log(`Authenticated (token ${maskToken(token)}).`);
  }),
);

const logout = new Command("logout").action(
  run(async () => {
    await clearToken();
    console.log(
      "Logged out — local credentials cleared. The token stays valid server-side until it expires; revoke it in the web UI to invalidate immediately.",
    );
  }),
);

export const authCommand = new Command("auth")
  .addCommand(login)
  .addCommand(status)
  .addCommand(logout);
