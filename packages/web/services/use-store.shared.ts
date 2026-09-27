import * as React from "react";

import type { Store } from "./store.shared";

export const useStore = <A>(store: Store<A>): A =>
  React.useSyncExternalStore(store.subscribe, store.get, store.get);
