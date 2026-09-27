import { CreateWalletEndpoint } from "./create-wallet.endpoint.js";
import { DeleteWalletEndpoint } from "./delete-wallet.endpoint.js";
import { GetWalletEndpoint } from "./get-wallet.endpoint.js";

export const walletEndpoints = [
  CreateWalletEndpoint,
  GetWalletEndpoint,
  DeleteWalletEndpoint,
] as const;
