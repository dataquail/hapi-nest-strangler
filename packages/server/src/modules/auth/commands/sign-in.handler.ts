import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { trace } from "@opentelemetry/api";
import { Err, Ok, type Result } from "oxide.ts";

import type { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import type { UserId } from "@/platform/ids/user-id.js";

import {
  IdentityEmailAlreadyRegistered,
  IdentityMissingEmail,
} from "../domain/auth-identity/auth-identity.errors.js";
import { AuthIdentityRepository } from "../domain/auth-identity/auth-identity.repository.js";
import { AuthIdentitySpecifications } from "../domain/auth-identity/auth-identity.specification.js";
import { UserProvisioning } from "../domain/ports/acl/user-provisioning.acl.js";
import { SessionId } from "../domain/session/session.id.js";
import { SessionRepository } from "../domain/session/session.repository.js";
import { SessionRootOps } from "../domain/session/session.root-ops.js";
import { SignInCommand, type SignInPayload, type SignInResult } from "./sign-in.command.js";

type ResolveUserResult = Result<
  UserId,
  IdentityMissingEmail | IdentityEmailAlreadyRegistered | PersistenceUnavailable
>;

// Provisioning, identity link and session insert share one unit of work, so a
// failure anywhere rolls the whole sign-in back.
@CommandHandler(SignInCommand)
export class SignInHandler implements ICommandHandler<SignInCommand> {
  constructor(
    @Inject(AuthIdentityRepository) private readonly identities: AuthIdentityRepository,
    @Inject(SessionRepository) private readonly sessions: SessionRepository,
    @Inject(UserProvisioning) private readonly provisioning: UserProvisioning,
    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}

  public execute({ payload }: SignInCommand): Promise<SignInResult> {
    return this.unitOfWork.run<SignInResult>(async () => {
      const userId = await this.resolveUser(payload);
      if (userId.isErr()) return userId;
      const now = new Date();
      const session = SessionRootOps.create({
        id: SessionId.parse(crypto.randomUUID()),
        userId: userId.unwrap(),
        subject: payload.subject,
        now,
        ttlSeconds: payload.ttlSeconds,
        absoluteTtlSeconds: payload.absoluteTtlSeconds,
      });
      const inserted = await this.sessions.insertOne(session);
      if (inserted.isErr()) return inserted;
      trace.getActiveSpan()?.setAttribute("user.id", session.userId);
      return Ok({ sessionId: session.id, userId: session.userId });
    });
  }

  private async resolveUser(payload: SignInPayload): Promise<ResolveUserResult> {
    const identity = await this.identities.findOne(
      AuthIdentitySpecifications.bySubject(payload.subject),
    );
    if (identity.isErr()) return identity;
    const existing = identity.unwrap();
    if (existing !== null) return Ok(existing.userId);
    if (payload.email === null) return Err(new IdentityMissingEmail({ subject: payload.subject }));
    const provisioned = await this.provisioning.provision(payload.email);
    if (provisioned.isErr()) {
      const error = provisioned.unwrapErr();
      return error._tag === "UserProvisioningConflict"
        ? Err(new IdentityEmailAlreadyRegistered({ email: error.email }))
        : Err(error);
    }
    const userId = provisioned.unwrap();
    const linked = await this.identities.insertOne({
      subject: payload.subject,
      userId,
      provider: "zitadel",
    });
    if (linked.isErr()) return linked;
    return Ok(userId);
  }
}
