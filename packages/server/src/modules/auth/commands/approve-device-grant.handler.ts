import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
} from "../domain/device-grant/device-grant.errors.js";
import { DeviceGrantRepository } from "../domain/device-grant/device-grant.repository.js";
import { DeviceGrantRootOps } from "../domain/device-grant/device-grant.root-ops.js";
import { DeviceGrantSpecifications } from "../domain/device-grant/device-grant.specification.js";
import {
  ApproveDeviceGrantCommand,
  type ApproveDeviceGrantResult,
} from "./approve-device-grant.command.js";

// Idempotent: re-approving an already approved grant re-stamps it.
@CommandHandler(ApproveDeviceGrantCommand)
export class ApproveDeviceGrantHandler implements ICommandHandler<ApproveDeviceGrantCommand> {
  constructor(
    @Inject(DeviceGrantRepository) private readonly grants: DeviceGrantRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: ApproveDeviceGrantCommand): Promise<ApproveDeviceGrantResult> {
    return this.unitOfWork.run<ApproveDeviceGrantResult>(async () => {
      const found = await this.grants.findOne(
        DeviceGrantSpecifications.withUserCode(payload.userCode),
      );
      if (found.isErr()) return found;
      const grant = found.unwrap();
      if (grant === null) return Err(new DeviceGrantNotFound({}));
      const now = new Date();
      if (DeviceGrantSpecifications.isExpired(grant, now)) return Err(new DeviceGrantExpired({}));
      return this.grants.updateOne(
        DeviceGrantRootOps.approve({ grant, userId: payload.userId, now }),
      );
    });
  }
}
