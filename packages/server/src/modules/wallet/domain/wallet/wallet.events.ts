import { z } from "zod";

import * as Event from "@/platform/ddd/contracts/domain-event.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/domain-event.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletId } from "./wallet.id.js";

export const WalletCreated = Event.make("WalletCreated", {
  walletId: WalletId,
  organizationId: OrganizationId,
});
export type WalletCreated = Event.Type<typeof WalletCreated>;

export const walletCreatedSpanAttributes: SpanAttributesExtractor<WalletCreated> = (event) => ({
  "wallet.id": event.walletId,
  "organization.id": event.organizationId,
});

export const WalletCredited = Event.make("WalletCredited", {
  walletId: WalletId,
  amount: z.number(),
  newBalance: z.number(),
});
export type WalletCredited = Event.Type<typeof WalletCredited>;

export const walletCreditedSpanAttributes: SpanAttributesExtractor<WalletCredited> = (event) => ({
  "wallet.id": event.walletId,
  "wallet.amount": event.amount,
  "wallet.new_balance": event.newBalance,
});

export const WalletDebited = Event.make("WalletDebited", {
  walletId: WalletId,
  amount: z.number(),
  newBalance: z.number(),
});
export type WalletDebited = Event.Type<typeof WalletDebited>;

export const walletDebitedSpanAttributes: SpanAttributesExtractor<WalletDebited> = (event) => ({
  "wallet.id": event.walletId,
  "wallet.amount": event.amount,
  "wallet.new_balance": event.newBalance,
});

export type WalletEvent = WalletCreated | WalletCredited | WalletDebited;
