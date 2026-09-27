// One QueryClient per request, so a prefetch on the server never leaks a
// cached page into another request's render.
import "server-only";

import type { QueryClient } from "@tanstack/react-query";
import * as React from "react";

import { makeQueryClient } from "./query-client.shared";

export const getQueryClient = React.cache((): QueryClient => makeQueryClient());
