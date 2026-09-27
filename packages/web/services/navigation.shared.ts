// Routing as state, in both directions: the current pathname arrives inbound,
// a request to move goes outbound, and one bridge owns the Next router.

import { makeStore } from "./store.shared";

export const pathnameStore = makeStore<string>("/");

export type NavigationRequest = {
  // Two consecutive requests to the same href are two navigations.
  readonly seq: number;
  readonly href: string;
};

export const navigationRequestStore = makeStore<NavigationRequest | null>(null);

export const navigateTo = (href: string): void => {
  const previous = navigationRequestStore.get();
  navigationRequestStore.set({ seq: (previous?.seq ?? 0) + 1, href });
};
