import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import type { OrganizationId } from "@/platform/ids/organization-id.js";

import type { WalletRoot } from "./wallet.root.js";

const forOrganization = (organizationId: OrganizationId): Specification<WalletRoot> =>
  Spec.eq<WalletRoot, "organizationId">("organizationId", organizationId);

export const WalletSpecifications = { forOrganization } as const;
