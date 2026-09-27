import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import * as path from "node:path";

import { z } from "zod";

import { tokenFromEnv } from "./config.js";

// `$XDG_CONFIG_HOME/org-cli/credentials.json` (falls back to `~/.config`):
// the device-flow or pasted token plus an optional default organization.
const CONFIG_DIR = "org-cli";
const FILE_NAME = "credentials.json";

export const Credentials = z.object({
  token: z.string().optional(),
  defaultOrgId: z.string().optional(),
});
export type Credentials = z.infer<typeof Credentials>;

const credentialsPath = (): string => {
  const base = process.env.XDG_CONFIG_HOME ?? path.join(homedir(), ".config");
  return path.join(base, CONFIG_DIR, FILE_NAME);
};

// A missing or unparseable file is empty credentials: a first run or a stale
// hand edit must not crash the CLI.
export const readCredentials = async (): Promise<Credentials> => {
  let raw: string;
  try {
    raw = await readFile(credentialsPath(), "utf8");
  } catch {
    return {};
  }
  try {
    const parsed = Credentials.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
};

const writeCredentials = async (credentials: Credentials): Promise<void> => {
  const file = credentialsPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(credentials, null, 2)}\n`);
  // The token is a bearer secret: owner-only.
  await chmod(file, 0o600);
};

export const saveToken = async (token: string): Promise<void> =>
  writeCredentials({ ...(await readCredentials()), token });

export const clearToken = async (): Promise<void> => {
  const { defaultOrgId } = await readCredentials();
  await writeCredentials(defaultOrgId === undefined ? {} : { defaultOrgId });
};

export const saveDefaultOrg = async (defaultOrgId: string): Promise<void> =>
  writeCredentials({ ...(await readCredentials()), defaultOrgId });

export const resolveToken = (credentials: Credentials): string | null =>
  tokenFromEnv() ?? credentials.token ?? null;
