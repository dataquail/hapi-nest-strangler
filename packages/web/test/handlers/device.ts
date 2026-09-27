import { AuthContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";

import { fail, ok, typedHandler } from "../typed-handler";

export const deviceHandlers = {
  approve: (
    outcome: { readonly result: "success" | "NotFound" | "Gone" } = { result: "success" },
  ) =>
    typedHandler(AuthContract.DeviceApprovalGroup.routes.approve, () => {
      if (outcome.result === "NotFound")
        return fail(HttpErrors.NotFound, { message: "Unknown device code." });
      if (outcome.result === "Gone")
        return fail(HttpErrors.Gone, { message: "That code has expired." });
      return ok(undefined);
    }),
};
