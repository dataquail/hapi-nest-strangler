import { describe, expect, it } from "vitest";

import { makeMyOrganization, ORG_B_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { renderViewModel } from "@/test/query-harness";

import { useOrgPickerViewModel } from "./org-picker.view-model";

describe("org picker ViewModel", () => {
  it("turns each membership into a card that links into that org", async () => {
    server.use(
      orgsHandlers.findMine([
        makeMyOrganization({ name: "Org A" }),
        makeMyOrganization({ id: ORG_B_ID, name: "Org B" }),
      ]),
    );

    const view = await renderViewModel(useOrgPickerViewModel).settle(() => true);

    expect(view.cards).toEqual([
      { id: makeMyOrganization().id, name: "Org A", href: `/orgs/${makeMyOrganization().id}` },
      { id: ORG_B_ID, name: "Org B", href: `/orgs/${ORG_B_ID}` },
    ]);
    expect(view.isEmpty).toBe(false);
  });

  it("reports emptiness once an empty list has arrived", async () => {
    server.use(orgsHandlers.findMine([]));

    const view = await renderViewModel(useOrgPickerViewModel).settle(() => true);

    expect(view.isEmpty).toBe(true);
  });
});
