// Which server answers a path while the strangler moves modules across: a
// path a Nest module serves goes to the Nest server, everything else to the
// legacy API. The web proxy's rewrites and the server-side client read the
// same table, so moving a module is one entry here.
const NEST_SERVED_PATHS: ReadonlyArray<RegExp> = [
  /^\/(?:cli\/)?orgs\/[^/]+\/todos(?:\/|$)/,
  /^\/orgs\/[^/]+\/billing(?:\/|$)/,
  /^\/webhooks\/stripe$/,
];

export const isServedByNest = (path: string): boolean =>
  NEST_SERVED_PATHS.some((pattern) => pattern.test(path));

export type Upstreams = { readonly legacy: string; readonly nest: string };

export const upstreamFor = (path: string, upstreams: Upstreams): string =>
  isServedByNest(path) ? upstreams.nest : upstreams.legacy;
