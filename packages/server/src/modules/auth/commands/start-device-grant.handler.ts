import { randomBytes } from "node:crypto";

import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { DeviceGrantId } from "../domain/device-grant/device-grant.id.js";
import { DeviceGrantRepository } from "../domain/device-grant/device-grant.repository.js";
import { DeviceGrantRootOps } from "../domain/device-grant/device-grant.root-ops.js";
import { CredentialHash } from "../domain/domain-services/credential-hash.domain-service.js";
import {
  StartDeviceGrantCommand,
  type StartDeviceGrantResult,
} from "./start-device-grant.command.js";

@CommandHandler(StartDeviceGrantCommand)
export class StartDeviceGrantHandler implements ICommandHandler<StartDeviceGrantCommand> {
  constructor(
    @Inject(DeviceGrantRepository) private readonly grants: DeviceGrantRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: StartDeviceGrantCommand): Promise<StartDeviceGrantResult> {
    return this.unitOfWork.run<StartDeviceGrantResult>(async () => {
      const deviceCode = randomBytes(32).toString("base64url");
      const userCode = DeviceGrantRootOps.toUserCode(randomBytes(16));
      const grant = DeviceGrantRootOps.start({
        id: DeviceGrantId.parse(crypto.randomUUID()),
        deviceCodeHash: CredentialHash.of(deviceCode),
        userCode,
        now: new Date(),
        ttlSeconds: payload.ttlSeconds,
      });
      const inserted = await this.grants.insertOne(grant);
      if (inserted.isErr()) return inserted;
      return Ok({ deviceCode, userCode, expiresAt: grant.expiresAt });
    });
  }
}
