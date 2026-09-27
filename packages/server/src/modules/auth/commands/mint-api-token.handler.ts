import { randomBytes } from "node:crypto";

import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { trace } from "@opentelemetry/api";
import { Ok } from "oxide.ts";

import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";

import { ApiTokenId } from "../domain/api-token/api-token.id.js";
import { ApiTokenRepository } from "../domain/api-token/api-token.repository.js";
import { ApiTokenRootOps } from "../domain/api-token/api-token.root-ops.js";
import { CredentialHash } from "../domain/domain-services/credential-hash.domain-service.js";
import {
  MintApiTokenCommand,
  type MintApiTokenPayload,
  type MintApiTokenResult,
} from "./mint-api-token.command.js";

const DAY_MS = 86_400_000;

// The transaction-free core, shared with the device-flow poll so it can mint
// and consume its grant inside one unit of work.
export const mintApiTokenCore = async (
  tokens: ApiTokenRepository,
  input: MintApiTokenPayload,
): Promise<MintApiTokenResult> => {
  const publicId = randomBytes(4).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const token = ApiTokenRootOps.assembleToken(publicId, secret);
  const now = new Date();
  const apiToken = ApiTokenRootOps.mint({
    id: ApiTokenId.parse(crypto.randomUUID()),
    userId: input.userId,
    tokenHash: CredentialHash.of(token),
    prefix: ApiTokenRootOps.displayPrefix(publicId),
    label: input.label,
    now,
    expiresAt: new Date(now.getTime() + input.expiresInDays * DAY_MS),
  });
  const inserted = await tokens.insertOne(apiToken);
  if (inserted.isErr()) return inserted;
  trace.getActiveSpan()?.setAttribute("user.id", input.userId);
  return Ok({ apiToken, token });
};

@CommandHandler(MintApiTokenCommand)
export class MintApiTokenHandler implements ICommandHandler<MintApiTokenCommand> {
  constructor(
    @Inject(ApiTokenRepository) private readonly tokens: ApiTokenRepository,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: MintApiTokenCommand): Promise<MintApiTokenResult> {
    return this.unitOfWork.run<MintApiTokenResult>(() => mintApiTokenCore(this.tokens, payload));
  }
}
