// Server-only: the current user, or null when unauthenticated. Memoised per
// request because the guard, a nested guard and the nav all ask.
import "server-only";

import * as React from "react";

import { getServerApiClient } from "../api/client.server";
import type { Schemas } from "../api/types";

export const fetchCurrentUser = React.cache(
  async (): Promise<Schemas["CurrentUserResponse"] | null> => {
    try {
      const client = await getServerApiClient();
      const { data } = await client.GET("/auth/me");
      return data ?? null;
    } catch {
      return null;
    }
  },
);
