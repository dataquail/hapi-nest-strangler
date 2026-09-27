import { Err, Ok, type Result } from "oxide.ts";

import type { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletInsufficientFunds, WalletInvalidAmount } from "./wallet.errors.js";
import { WalletCreated, WalletCredited, WalletDebited, type WalletEvent } from "./wallet.events.js";
import type { WalletId } from "./wallet.id.js";
import { WalletRoot } from "./wallet.root.js";

export type Outcome = {
  readonly wallet: WalletRoot;
  readonly events: ReadonlyArray<WalletEvent>;
};

export type CreateInput = {
  readonly id: WalletId;
  readonly organizationId: OrganizationId;
  readonly now: Date;
};

const create = (input: CreateInput): Outcome => {
  const wallet = WalletRoot.parse({
    id: input.id,
    organizationId: input.organizationId,
    balance: 0,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    wallet,
    events: [WalletCreated.make({ walletId: wallet.id, organizationId: wallet.organizationId })],
  };
};

export type AmountInput = {
  readonly amount: number;
  readonly now: Date;
};

const isPositiveAmount = (amount: number): boolean => Number.isFinite(amount) && amount > 0;

const credit = (wallet: WalletRoot, input: AmountInput): Result<Outcome, WalletInvalidAmount> => {
  if (!isPositiveAmount(input.amount)) {
    return Err(new WalletInvalidAmount({ walletId: wallet.id, amount: input.amount }));
  }
  const newBalance = wallet.balance + input.amount;
  return Ok({
    wallet: WalletRoot.parse({ ...wallet, balance: newBalance, updatedAt: input.now }),
    events: [WalletCredited.make({ walletId: wallet.id, amount: input.amount, newBalance })],
  });
};

// A balance never goes negative: the invariant lives here, enforced once.
const debit = (
  wallet: WalletRoot,
  input: AmountInput,
): Result<Outcome, WalletInvalidAmount | WalletInsufficientFunds> => {
  if (!isPositiveAmount(input.amount)) {
    return Err(new WalletInvalidAmount({ walletId: wallet.id, amount: input.amount }));
  }
  if (input.amount > wallet.balance) {
    return Err(
      new WalletInsufficientFunds({
        walletId: wallet.id,
        balance: wallet.balance,
        attemptedDebit: input.amount,
      }),
    );
  }
  const newBalance = wallet.balance - input.amount;
  return Ok({
    wallet: WalletRoot.parse({ ...wallet, balance: newBalance, updatedAt: input.now }),
    events: [WalletDebited.make({ walletId: wallet.id, amount: input.amount, newBalance })],
  });
};

export const WalletRootOps = { create, credit, debit } as const;
