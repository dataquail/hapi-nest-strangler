// MSW node server shared across the suite. The default handler set 401s
// `/auth/me`; per-test overrides go through `server.use(...)`.

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

import { defaultHandlers } from "./handlers";

export const server = setupServer();

export const installMswLifecycle = (): void => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: "error" });
  });
  beforeEach(() => {
    server.use(...defaultHandlers);
  });
  afterEach(() => {
    server.resetHandlers();
  });
  afterAll(() => {
    server.close();
  });
};
