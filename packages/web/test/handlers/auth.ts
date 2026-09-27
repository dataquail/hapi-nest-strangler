import { AuthContract } from "@org/contracts/api/Contracts";

import { makeCurrentUser } from "../fixtures/auth";
import { ok, typedHandler, unauthorized } from "../typed-handler";

const me = AuthContract.PrivateGroup.routes.me;

export const authHandlers = {
  signedInAs: (overrides?: Parameters<typeof makeCurrentUser>[0]) =>
    typedHandler(me, () => ok(makeCurrentUser(overrides))),
  signedOut: () => typedHandler(me, () => unauthorized()),
};
