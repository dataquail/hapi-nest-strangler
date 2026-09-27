import { writeFileSync } from "node:fs";
import * as path from "node:path";

import { buildOpenApiDocument } from "../openapi/document.js";

const target = path.join(import.meta.dirname, "..", "..", "openapi.json");
writeFileSync(target, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`);
process.stdout.write(`wrote ${target}\n`);
