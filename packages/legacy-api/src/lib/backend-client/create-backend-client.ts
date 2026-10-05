import { createBillingApi } from "./domains/billing";
import { createWalletsApi } from "./domains/wallets";
import { createHttpClient } from "./http";

type BackendClientOptions = {
  baseUrl: string;
  authenticate: () => Promise<string>;
};

export type BackendClient = {
  billing: ReturnType<typeof createBillingApi>;
  wallets: ReturnType<typeof createWalletsApi>;
};

export const createBackendClient = (options: BackendClientOptions): BackendClient => {
  const http = createHttpClient(options);
  return { billing: createBillingApi(http), wallets: createWalletsApi(http) };
};
