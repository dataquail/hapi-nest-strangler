// ViewModel for the org switcher: given the caller's organizations and the
// current pathname, the active org and the URL each option navigates to.
//
// The route shape is fixed (`/orgs/<uuid>/...`), so a literal regex reads it.
// Switching replaces the org segment in place and keeps the sub-route, so one
// org's billing page switches to another's billing page.

import type { OrganizationId } from "@org/contracts/EntityIds";
import { useSuspenseQuery } from "@tanstack/react-query";
import * as React from "react";

import { myOrgsQuery } from "@/services/data-access/orgs.queries";
import { navigateTo, pathnameStore } from "@/services/navigation.shared";
import { useStore } from "@/services/use-store.shared";

export type OrgOption = {
  readonly id: string;
  readonly name: string;
  readonly href: string;
};

export type OrgSwitcherView = {
  readonly activeOrgId: string | null;
  readonly options: ReadonlyArray<OrgOption>;
  readonly isEmpty: boolean;
};

// Group 2 always matches (the empty string when there is no sub-route).
const ORG_PATH_PATTERN = /^\/orgs\/([^/]+)(.*)$/;

export const extractActiveOrgId = (pathname: string): string | null => {
  const match = ORG_PATH_PATTERN.exec(pathname);
  return match === null ? null : match[1];
};

const buildHref = (orgId: string, pathname: string): string => {
  const match = ORG_PATH_PATTERN.exec(pathname);
  return match === null ? `/orgs/${orgId}` : `/orgs/${orgId}${match[2]}`;
};

export const computeOrgSwitcherView = (input: {
  readonly orgs: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly pathname: string;
}): OrgSwitcherView => {
  const activeId = extractActiveOrgId(input.pathname);
  const options = input.orgs.map((org) => ({
    id: org.id,
    name: org.name,
    href: buildHref(org.id, input.pathname),
  }));
  const activeOrgId =
    activeId === null ? null : (options.find((option) => option.id === activeId)?.id ?? null);
  return { activeOrgId, options, isEmpty: options.length === 0 };
};

export type OrgSwitcherViewModel = OrgSwitcherView & {
  readonly selectOrg: (orgId: OrganizationId | string) => void;
  readonly createNew: () => void;
};

export const useOrgSwitcherViewModel = (): OrgSwitcherViewModel => {
  const { data: orgs } = useSuspenseQuery(myOrgsQuery());
  const pathname = useStore(pathnameStore);
  const view = React.useMemo(() => computeOrgSwitcherView({ orgs, pathname }), [orgs, pathname]);
  const selectOrg = React.useCallback(
    (orgId: string) => {
      const option = view.options.find((candidate) => candidate.id === orgId);
      if (option !== undefined) navigateTo(option.href);
    },
    [view.options],
  );
  const createNew = React.useCallback(() => {
    navigateTo("/");
  }, []);
  return { ...view, selectOrg, createNew };
};
