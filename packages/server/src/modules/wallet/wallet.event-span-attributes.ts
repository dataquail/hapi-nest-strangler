import type { SpanAttributes } from "@/platform/ddd/contracts/domain-event.js";

import {
  walletCreatedSpanAttributes,
  walletCreditedSpanAttributes,
  walletDebitedSpanAttributes,
} from "./domain/wallet/wallet.events.js";

export const walletEventSpanAttributes: SpanAttributes = {
  WalletCreated: walletCreatedSpanAttributes,
  WalletCredited: walletCreditedSpanAttributes,
  WalletDebited: walletDebitedSpanAttributes,
};
