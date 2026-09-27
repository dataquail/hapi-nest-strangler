import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";

import type { AuthIdentity } from "./auth-identity.repository.js";

const bySubject = (subject: string): Specification<AuthIdentity> =>
  Spec.eq<AuthIdentity, "subject">("subject", subject);

export const AuthIdentitySpecifications = { bySubject } as const;
