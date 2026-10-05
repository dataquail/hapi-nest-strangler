import { Controller, Inject, type RawBodyRequest, Req } from "@nestjs/common";
import { BillingContract } from "@org/contracts/api/Contracts";
import * as HttpErrors from "@org/contracts/HttpErrors";
import type { Request } from "express";

import { IngestStripeWebhookCommand } from "@/modules/billing/commands/ingest-stripe-webhook.command.js";
import { AppCommandBus } from "@/platform/cqrs/command-bus.js";
import { Endpoint, serviceUnavailable, unwrapOrThrow } from "@/platform/http/endpoint.js";
import { problem } from "@/platform/http/http-problem.js";

const route = BillingContract.PublicGroup.routes.handleStripeWebhook;

// No guard: the provider carries no session; the signature, verified inside
// the command, is the authentication. The raw body is what was signed.
@Controller()
export class StripeWebhookEndpoint {
  constructor(@Inject(AppCommandBus) private readonly commandBus: AppCommandBus) {}

  @Endpoint(route)
  public async handleStripeWebhook(@Req() request: RawBodyRequest<Request>): Promise<void> {
    const header = request.headers["stripe-signature"];
    const signature = Array.isArray(header) ? header[0] : header;
    if (signature === undefined || signature === "") {
      throw problem(HttpErrors.Unauthorized, { message: "Missing stripe-signature header" });
    }
    const payload = request.rawBody?.toString("utf8");
    if (payload === undefined)
      throw problem(HttpErrors.BadRequest, { message: "Missing request body" });
    unwrapOrThrow(
      await this.commandBus.execute(new IngestStripeWebhookCommand({ payload, signature })),
      {
        InvalidWebhookSignature: (error) =>
          problem(HttpErrors.Unauthorized, { message: error.message }),
        PersistenceUnavailable: serviceUnavailable,
      },
    );
  }
}
