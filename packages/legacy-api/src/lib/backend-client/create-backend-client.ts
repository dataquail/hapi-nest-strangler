import { createTodosApi } from "./domains/todos";
import { createWalletsApi } from "./domains/wallets";
import { createHttpClient } from "./http";

type BackendClientOptions = {
  baseUrl: string;
  authenticate: () => Promise<string>;
};

export type BackendClient = {
  todos: ReturnType<typeof createTodosApi>;
  wallets: ReturnType<typeof createWalletsApi>;
};

export const createBackendClient = (options: BackendClientOptions): BackendClient => {
  const http = createHttpClient(options);
  return { todos: createTodosApi(http), wallets: createWalletsApi(http) };
};
