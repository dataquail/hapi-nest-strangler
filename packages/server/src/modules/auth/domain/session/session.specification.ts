import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";

import type { SessionId } from "./session.id.js";
import type { SessionRoot } from "./session.root.js";

const withId = (id: SessionId): Specification<SessionRoot> => Spec.eq<SessionRoot, "id">("id", id);

export const SessionSpecifications = { withId } as const;
