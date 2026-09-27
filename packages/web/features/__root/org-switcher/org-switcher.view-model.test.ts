import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { navigationRequestStore, pathnameStore } from "@/services/navigation.shared";
import { makeMyOrganization, ORG_B_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";

import {
  computeOrgSwitcherView,
  extractActiveOrgId,
  useOrgSwitcherViewModel,
} from "./org-switcher.view-model";

const orgA = { id: "11111111-1111-1111-1111-111111111111", name: "Org A" };
const orgB = { id: "22222222-2222-2222-2222-222222222222", name: "Org B" };

describe("extractActiveOrgId", () => {
  it("pulls the id segment from an /orgs/:id path, nested or not", () => {
    expect(extractActiveOrgId("/orgs/11111111-1111-1111-1111-111111111111")).toBe(orgA.id);
    expect(extractActiveOrgId("/orgs/11111111-1111-1111-1111-111111111111/billing")).toBe(orgA.id);
  });

  it("returns null on a non-org path", () => {
    expect(extractActiveOrgId("/")).toBeNull();
    expect(extractActiveOrgId("/admin/orgs")).toBeNull();
    expect(extractActiveOrgId("/users")).toBeNull();
  });
});

describe("computeOrgSwitcherView", () => {
  it("derives options that preserve the trailing sub-route", () => {
    const view = computeOrgSwitcherView({
      orgs: [orgA, orgB],
      pathname: `/orgs/${orgA.id}/billing`,
    });
    expect(view.activeOrgId).toBe(orgA.id);
    expect(view.options.map((o) => o.href)).toEqual([
      `/orgs/${orgA.id}/billing`,
      `/orgs/${orgB.id}/billing`,
    ]);
  });

  it("from non-org paths the switch lands at the org root", () => {
    const view = computeOrgSwitcherView({ orgs: [orgA, orgB], pathname: "/admin/orgs" });
    expect(view.activeOrgId).toBeNull();
    expect(view.options.map((o) => o.href)).toEqual([`/orgs/${orgA.id}`, `/orgs/${orgB.id}`]);
  });

  it("flags an empty list", () => {
    expect(computeOrgSwitcherView({ orgs: [], pathname: "/" }).isEmpty).toBe(true);
  });

  it("returns null active id when the URL id matches no membership", () => {
    const view = computeOrgSwitcherView({
      orgs: [orgA],
      pathname: "/orgs/99999999-9999-9999-9999-999999999999",
    });
    expect(view.activeOrgId).toBeNull();
  });
});

describe("org switcher ViewModel", () => {
  it("re-derives its options when the pathname changes, without refetching", async () => {
    let fetches = 0;
    server.use(
      orgsHandlers.findMine([
        makeMyOrganization({ name: "Org A" }),
        makeMyOrganization({ id: ORG_B_ID, name: "Org B" }),
      ]),
    );
    server.events.on("request:start", () => {
      fetches += 1;
    });

    const harness = renderViewModel(useOrgSwitcherViewModel);
    await harness.settle(() => true);
    expect(harness.result.current.activeOrgId).toBeNull();

    act(() => {
      pathnameStore.set(`/orgs/${ORG_B_ID}/billing`);
    });

    const view = await harness.settle((value) => value.activeOrgId === ORG_B_ID);
    expect(view.options.map((o) => o.href)).toEqual([
      `/orgs/${makeMyOrganization().id}/billing`,
      `/orgs/${ORG_B_ID}/billing`,
    ]);
    expect(fetches).toBe(1);
    server.events.removeAllListeners();
  });

  it("asks to navigate to the selected org's href", async () => {
    server.use(orgsHandlers.findMine([makeMyOrganization({ id: ORG_B_ID, name: "Org B" })]));
    pathnameStore.set("/orgs/whatever/members");

    const harness = renderViewModel(useOrgSwitcherViewModel);
    await harness.settle(() => true);

    act(() => {
      harness.result.current.selectOrg(ORG_B_ID);
    });

    expect(navigationRequestStore.get()?.href).toBe(`/orgs/${ORG_B_ID}/members`);
  });

  it("ignores a selection that is not one of the caller's orgs", async () => {
    server.use(orgsHandlers.findMine([makeMyOrganization()]));

    const harness = renderViewModel(useOrgSwitcherViewModel);
    await harness.settle(() => true);

    act(() => {
      harness.result.current.selectOrg(ORG_B_ID);
    });

    expect(navigationRequestStore.get()).toBeNull();
  });

  it("sends the create-new affordance to the root picker", async () => {
    server.use(orgsHandlers.findMine([makeMyOrganization()]));
    pathnameStore.set("/orgs/anything");

    const harness = renderViewModel(useOrgSwitcherViewModel);
    await harness.settle(() => true);

    act(() => {
      harness.result.current.createNew();
    });

    expect(navigationRequestStore.get()?.href).toBe("/");
  });
});
