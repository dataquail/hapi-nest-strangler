// Next's `/api/*` rewrite strips the prefix before the request reaches this
// server, and the IdP rejects a redirect_uri that differs byte-for-byte from
// the authorize-time value: origin and path come from the env, only the query
// string from the inbound request.
export const buildCallbackUrl = (envRedirectUri: string, requestUrl: string): URL => {
  const queryIndex = requestUrl.indexOf("?");
  const query = queryIndex >= 0 ? requestUrl.slice(queryIndex) : "";
  return new URL(envRedirectUri + query);
};
