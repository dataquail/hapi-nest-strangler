import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { Err } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { ApiTokenRepository } from "../domain/api-token/api-token.repository.js";
import {
  DeviceGrantExpired,
  DeviceGrantNotFound,
  DeviceGrantPending,
} from "../domain/device-grant/device-grant.errors.js";
import { DeviceGrantRepository } from "../domain/device-grant/device-grant.repository.js";
import { DeviceGrantSpecifications } from "../domain/device-grant/device-grant.specification.js";
import { CredentialHash } from "../domain/domain-services/credential-hash.domain-service.js";
import { mintApiTokenCore } from "./mint-api-token.handler.js";
import { PollDeviceGrantCommand, type PollDeviceGrantResult } from "./poll-device-grant.command.js";

// Single-use exchange: the token is minted and the grant consumed in one
// transaction, so a grant can never yield two tokens.
@CommandHandler(PollDeviceGrantCommand)
export class PollDeviceGrantHandler implements ICommandHandler<PollDeviceGrantCommand> {
  constructor(
    @Inject(DeviceGrantRepository) private readonly grants: DeviceGrantRepository,
    @Inject(ApiTokenRepository) private readonly tokens: ApiTokenRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: PollDeviceGrantCommand): Promise<PollDeviceGrantResult> {
    return this.unitOfWork.run<PollDeviceGrantResult>(async () => {
      const found = await this.grants.findOne(
        DeviceGrantSpecifications.withCodeHash(CredentialHash.of(payload.deviceCode)),
      );
      if (found.isErr()) return found;
      const grant = found.unwrap();
      if (grant === null) return Err(new DeviceGrantNotFound({}));
      if (DeviceGrantSpecifications.isExpired(grant, new Date())) {
        await this.grants.deleteOne(grant.id);
        return Err(new DeviceGrantExpired({}));
      }
      if (grant.status === "pending" || grant.userId === null)
        return Err(new DeviceGrantPending({}));
      const minted = await mintApiTokenCore(this.tokens, {
        userId: grant.userId,
        label: "cli",
        expiresInDays: payload.tokenExpiresInDays,
      });
      if (minted.isErr()) return minted;
      const consumed = await this.grants.deleteOne(grant.id);
      if (consumed.isErr() && consumed.unwrapErr()._tag === "PersistenceUnavailable") {
        return Err(consumed.unwrapErr());
      }
      return minted;
    });
  }
}
