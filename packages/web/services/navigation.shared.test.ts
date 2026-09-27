import { beforeEach, describe, expect, it } from "vitest";

import { navigateTo, navigationRequestStore } from "./navigation.shared";

describe("navigateTo", () => {
  beforeEach(() => {
    navigationRequestStore.set(null);
  });

  it("records a request with an advancing sequence", () => {
    navigateTo("/a");
    navigateTo("/a");
    expect(navigationRequestStore.get()).toEqual({ seq: 2, href: "/a" });
  });
});
