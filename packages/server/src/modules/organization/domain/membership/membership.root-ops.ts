import type { OrganizationId } from "@/platform/ids/organization-id.js";
import type { UserId } from "@/platform/ids/user-id.js";

import { MembershipCreated, type MembershipEvent, MembershipRevoked } from "./membership.events.js";
import { MembershipRoot } from "./membership.root.js";

export type Outcome = {
  readonly membership: MembershipRoot;
  readonly events: ReadonlyArray<MembershipEvent>;
};

export type CreateInput = {
  readonly userId: UserId;
  readonly organizationId: OrganizationId;
  readonly now: Date;
};

const create = (input: CreateInput): Outcome => {
  const membership = MembershipRoot.parse({
    userId: input.userId,
    organizationId: input.organizationId,
    createdAt: input.now,
  });
  return {
    membership,
    events: [
      MembershipCreated.make({
        userId: membership.userId,
        organizationId: membership.organizationId,
      }),
    ],
  };
};

export type RevokeOutcome = { readonly events: ReadonlyArray<MembershipEvent> };

const revoke = (membership: MembershipRoot): RevokeOutcome => ({
  events: [
    MembershipRevoked.make({
      userId: membership.userId,
      organizationId: membership.organizationId,
    }),
  ],
});

export const MembershipRootOps = { create, revoke } as const;
