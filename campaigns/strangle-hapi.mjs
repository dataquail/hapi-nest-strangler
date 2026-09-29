// The custom terms of the `strangle-hapi` campaign. The engine hands each
// function one file — its path, text and parsed facts — and takes back the
// subjects it found, or a number. Nothing here runs the code it reads.

const MODULE_FOLDER = /^packages\/legacy-api\/src\/application\/([^/]+)\//;
const HAPI_MODULES = new Set(["user", "auth", "organization", "todo", "billing"]);

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

// Non-blank lines a file adds to the hapi package; a file on the Nest side
// weighs nothing, so rebuilding a module never reads as growth.
/** @type {import("@goodbones/campaigns").CampaignMeasure} */
export const hapiLines = ({ file, text }) =>
  file.startsWith("packages/legacy-api/")
    ? text.split("\n").filter((line) => line.trim() !== "").length
    : 0;
