import type { HttpClient } from "../http";

export type Wallet = { id: string; organizationId: string; balance: number };

// The Nest server's internal wallet API. Create and delete are idempotent
// there, so a retry or a compensation after a partial failure is safe.
export const createWalletsApi = (http: HttpClient) => ({
  create: (body: { organizationId: string }) =>
    http.post("/internal/wallets", body) as Promise<Wallet>,
  get: (organizationId: string) =>
    http.get(`/internal/wallets/${organizationId}`) as Promise<Wallet>,
  remove: (organizationId: string) =>
    http.delete(`/internal/wallets/${organizationId}`) as Promise<void>,
});
