// The CLI and MCP point at a deployed gateway via APP_API_URL; the default is
// the local web's /api, whose rewrites send each path to the server that
// serves it while the strangler moves modules (ADR-0035).
export const resolveBaseUrl = (): string => process.env.APP_API_URL ?? "http://localhost:3000/api";

// A pre-minted token in the environment wins over any stored credential, so
// pipelines need no `auth login` and no on-disk state.
export const tokenFromEnv = (): string | null => {
  const fromEnv = process.env.APP_API_TOKEN;
  return fromEnv !== undefined && fromEnv.length > 0 ? fromEnv : null;
};
