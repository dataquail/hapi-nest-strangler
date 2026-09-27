import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { SendInvitationEmailCommand } from "@/modules/organization/commands/send-invitation-email.command.js";
import {
  InvitationIssued,
  InvitationReissued,
} from "@/modules/organization/domain/invitation/invitation.events.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";
import type { InvitationId } from "@/platform/ids/invitation-id.js";

// After commit, in its own unit of work: a mail-server outage cannot fail the
// invite, and a rolled-back transaction cannot produce a live accept link.
@Injectable()
export class InvitationEventAdapter implements OnModuleInit {
  constructor(
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
  ) {}

  public onModuleInit(): void {
    this.events.subscribeAfterCommit(InvitationIssued, (event) => this.send(event.invitationId));
    this.events.subscribeAfterCommit(InvitationReissued, (event) => this.send(event.invitationId));
  }

  private async send(invitationId: InvitationId): Promise<void> {
    const result = await this.commandBus.execute(new SendInvitationEmailCommand({ invitationId }));
    if (result.isErr())
      throw new Error(`SendInvitationEmailCommand failed: ${result.unwrapErr()._tag}`);
  }
}
