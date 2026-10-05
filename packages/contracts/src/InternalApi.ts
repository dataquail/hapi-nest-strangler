import * as InternalWalletContract from "./api/InternalWalletContract.js";
import type { ContractGroup } from "./Route.js";

/** The service-to-service API: what the legacy API calls on the Nest server with an inter-service token. */
export const InternalApi: ReadonlyArray<ContractGroup> = [InternalWalletContract.Group];
