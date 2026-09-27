import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";

import { CreateWalletCommand } from "@/modules/wallet/commands/create-wallet.command.js";
import { organizationAccessDomainEvents } from "@/modules/wallet/wallet.imports.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { DomainEventBus } from "@/platform/ddd/event-bus.js";

// Immediate: runs in the publisher's transaction, so a failed wallet creation
// rolls the organization back and an org never exists without its wallet.
@Injectable()
export class OrganizationEventAdapter implements OnModuleInit {
  constructor(
    @Inject(DomainEventBus) private readonly events: DomainEventBus,
    @Inject(AppCommandBus) private readonly commandBus: AppCommandBus,
  ) {}

  public onModuleInit(): void {
    this.events.subscribe(organizationAccessDomainEvents.OrganizationCreated, async (event) => {
      const result = await this.commandBus.execute(
        new CreateWalletCommand({ organizationId: event.organizationId }),
      );
      if (result.isErr()) throw new Error(`CreateWalletCommand failed: ${result.unwrapErr()._tag}`);
    });
  }
}
