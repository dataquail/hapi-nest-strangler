// The custom terms of the `strangle-hapi` campaign. The engine hands each
// function one file — its path, text and parsed facts — and takes back the
// subjects it found, or a number. Nothing here runs the code it reads.

const MODULE_FOLDER = /^packages\/legacy-api\/src\/application\/([^/]+)\//;
const HAPI_MODULES = new Set(["user", "auth", "organization", "todo", "billing"]);

// The write operations of a sector that share rows, so they leave hapi in one
// step: once one is served by the Nest server, the rows it writes stop
// reaching the legacy table every other one still reads and writes. Reads are
// not listed; they are served first. Each group names the one route file that
// declares all of its operations, since a term sees one file at a time.
export const SHARED_STATE_GROUPS = {
  billing: [
    {
      name: "subscription-lifecycle",
      routes: "billing-routes.ts",
      operations: [
        "POST /orgs/{orgId}/billing/subscriptions",
        "DELETE /orgs/{orgId}/billing/subscriptions/current",
        "POST /webhooks/stripe",
      ],
    },
  ],
  organization: [
    {
      name: "organization-writes",
      routes: "organization-routes.ts",
      operations: [
        "POST /orgs",
        "DELETE /orgs/{id}",
        "POST /orgs/{id}/restore",
        "POST /orgs/{orgId}/invitations",
        "DELETE /orgs/{orgId}/invitations/{invitationId}",
        "POST /orgs/{orgId}/invitations/{invitationId}/resend",
        "POST /invitations/{token}/accept",
        "DELETE /orgs/{orgId}/members/{userId}",
        "POST /orgs/{orgId}/leave",
        "POST /orgs/{orgId}/members/{userId}/admin",
        "DELETE /orgs/{orgId}/members/{userId}/admin",
      ],
    },
  ],
};

const rangeAt = (text, index) => {
  const before = text.slice(0, index);
  const line = before.split("\n").length - 1;
  const column = index - (before.lastIndexOf("\n") + 1);
  return { start: { line, column }, end: { line, column } };
};

// A hapi module reaching into a sibling module: a relative import of its
// files, or the container id of one of its factories in an `@require` list.
// The substrate under `src/lib` is not judged; it dies with the package.
/** @type {import("@goodbones/campaigns").CampaignPredicate} */
export const crossModuleReach = ({ file, text }) => {
  const own = MODULE_FOLDER.exec(file)?.[1];
  if (own === undefined) return [];
  const seen = new Set();
  const subjects = [];
  const found = (subject, index) => {
    if (seen.has(subject)) return;
    seen.add(subject);
    subjects.push({ subject, range: rangeAt(text, index) });
  };
  for (const hit of text.matchAll(
    /(?:from\s*|require\s*\(\s*)["'](\.\.\/([^/"']+)\/[^"']*)["']/g,
  )) {
    const peer = hit[2];
    if (peer !== own && HAPI_MODULES.has(peer)) found(`imports:${hit[1]}`, hit.index);
  }
  for (const list of text.matchAll(/\[\s*["']@require["']\s*\]\s*=\s*\[([^\]]*)\]/g)) {
    for (const id of list[1].matchAll(/["']([^"']+)["']/g)) {
      const peer = id[1].split("/")[0];
      if (id[1].includes("/") && peer !== own && HAPI_MODULES.has(peer)) {
        found(`requires:${id[1]}`, list.index + id.index);
      }
    }
  }
  return subjects;
};

// A route object's own keys only: `ext.onPreHandler` entries carry a `method` too.
const ROUTE_OBJECT = {
  kind: "object",
  all: ["method", "path", "handler"].map((key) => ({
    has: { kind: "pair", has: { field: "key", regex: `^${key}$` } },
  })),
};

const routesIn = (syntax) =>
  syntax.findAll(ROUTE_OBJECT).flatMap((match) => {
    const method = /\bmethod:\s*["']([A-Za-z]+)["']/.exec(match.text)?.[1];
    const path = /\bpath:\s*["']([^"']+)["']/.exec(match.text)?.[1];
    if (method === undefined || path === undefined) return [];
    return [
      {
        operation: `${method.toUpperCase()} ${path}`,
        proxied: /\bhandler:\s*proxyToNest\s*\(/.test(match.text),
        range: match.range,
      },
    ];
  });

// A shared-state group whose operations are split between the two servers:
// some still served by hapi, the rest forwarded with `proxyToNest`. A group
// operation its route file no longer declares is reported too, so a stale
// group cannot pass for a whole one.
/** @type {import("@goodbones/campaigns").CampaignPredicate} */
export const sharedStateSplit = ({ file, syntax }) => {
  const own = MODULE_FOLDER.exec(file)?.[1];
  if (own === undefined || syntax === null) return [];
  const groups = (SHARED_STATE_GROUPS[own] ?? []).filter((group) =>
    file.endsWith(`/${group.routes}`),
  );
  if (groups.length === 0) return [];
  const routes = routesIn(syntax);
  return groups.flatMap((group) => {
    const members = group.operations.map((operation) => ({
      operation,
      route: routes.find((route) => route.operation === operation),
    }));
    const undeclared = members.filter((member) => member.route === undefined);
    if (undeclared.length > 0) {
      return undeclared.map((member) => ({
        subject: `${group.name}:undeclared:${member.operation}`,
      }));
    }
    const local = members.filter((member) => !member.route.proxied);
    if (local.length === 0 || local.length === members.length) return [];
    return [{ subject: group.name, range: local[0].route.range }];
  });
};

// Non-blank lines a file adds to the hapi server's source. A test, a
// migration or a file on the Nest side weighs nothing, so covering a module
// or rebuilding it never reads as growth; only its production code does.
/** @type {import("@goodbones/campaigns").CampaignMeasure} */
export const hapiLines = ({ file, text }) =>
  file.startsWith("packages/legacy-api/src/")
    ? text.split("\n").filter((line) => line.trim() !== "").length
    : 0;
