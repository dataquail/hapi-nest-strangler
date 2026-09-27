// The CLI and MCP point at a deployed server via APP_API_URL; the default is the local BFF.
export const resolveBaseUrl = (): string => process.env.APP_API_URL ?? "http://localhost:3001";

// A pre-minted token in the environment wins over any stored credential, so
// pipelines need no `auth login` and no on-disk state.
export const tokenFromEnv = (): string | null => {
  const fromEnv = process.env.APP_API_TOKEN;
  return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : null;
};
