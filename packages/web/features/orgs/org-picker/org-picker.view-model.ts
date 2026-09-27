// ViewModel for the root organization picker. The list is not paginated:
// `findMine` returns the caller's memberships and nothing else.

import { useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";

import { myOrgsQuery } from "@/services/data-access/orgs.queries";

export type OrgCard = {
  readonly id: string;
  readonly name: string;
  readonly href: string;
};

export type OrgPickerViewModel = {
  readonly cards: ReadonlyArray<OrgCard>;
  readonly isEmpty: boolean;
};

export const useOrgPickerViewModel = (): OrgPickerViewModel => {
  const { data: orgs } = useSuspenseQuery(myOrgsQuery());
  return React.useMemo(
    () => ({
      cards: orgs.map((org) => ({ id: org.id, name: org.name, href: `/orgs/${org.id}` })),
      isEmpty: orgs.length === 0,
    }),
    [orgs],
  );
};
