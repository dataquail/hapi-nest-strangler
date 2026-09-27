// The wire types, as the generated client returns them. A ViewModel names these
// rather than the zod contract types: an id on the wire is a plain string, and
// the contract's branded ids narrow to it but not the other way round.

import type { components } from "@org/contracts/generated/api";

export type Schemas = components["schemas"];
