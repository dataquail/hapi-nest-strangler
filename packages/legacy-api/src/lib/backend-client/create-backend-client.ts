import { createWalletsApi } from "./domains/wallets";
import { createHttpClient } from "./http";

type BackendClientOptions = {
  baseUrl: string;
  authenticate: () => Promise<string>;
};

export type BackendClient = {
  wallets: ReturnType<typeof createWalletsApi>;
};

export const createBackendClient = (options: BackendClientOptions): BackendClient => {
  const http = createHttpClient(options);
  return { wallets: createWalletsApi(http) };
};
