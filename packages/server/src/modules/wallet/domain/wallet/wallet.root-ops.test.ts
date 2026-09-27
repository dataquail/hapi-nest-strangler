import { deepStrictEqual } from "node:assert";

import { describe, it } from "vitest";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { WalletId } from "./wallet.id.js";
import type { WalletRoot } from "./wallet.root.js";
import { WalletRootOps } from "./wallet.root-ops.js";

const walletId = WalletId.parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.parse("11111111-1111-1111-1111-111111111111");
const now = new Date("2025-01-01T00:00:00Z");
const later = new Date("2025-02-01T00:00:00Z");

const fresh = (): WalletRoot => WalletRootOps.create({ id: walletId, organizationId, now }).wallet;
const funded = (): WalletRoot =>
  WalletRootOps.credit(fresh(), { amount: 100, now }).unwrap().wallet;

describe("WalletRootOps.create", () => {
  it("constructs a wallet with balance 0 and emits exactly one WalletCreated", () => {
    const { events, wallet } = WalletRootOps.create({ id: walletId, organizationId, now });
    deepStrictEqual(wallet, {
      id: walletId,
      organizationId,
      balance: 0,
      createdAt: now,
      updatedAt: now,
    });
    deepStrictEqual(events, [{ _tag: "WalletCreated", walletId, organizationId }]);
  });
});

describe("WalletRootOps.credit", () => {
  it("increases balance by amount and emits WalletCredited with the new balance", () => {
    const { events, wallet } = WalletRootOps.credit(fresh(), { amount: 100, now: later }).unwrap();
    deepStrictEqual(wallet.balance, 100);
    deepStrictEqual(wallet.updatedAt, later);
    deepStrictEqual(events, [{ _tag: "WalletCredited", walletId, amount: 100, newBalance: 100 }]);
  });

  it("rejects zero, negative and non-finite amounts", () => {
    for (const amount of [0, -10, NaN, Infinity]) {
      deepStrictEqual(
        WalletRootOps.credit(fresh(), { amount, now: later }).unwrapErr()._tag,
        "WalletInvalidAmount",
      );
    }
  });
});

describe("WalletRootOps.debit", () => {
  it("decreases balance by amount and emits WalletDebited with the new balance", () => {
    const { events, wallet } = WalletRootOps.debit(funded(), { amount: 30, now: later }).unwrap();
    deepStrictEqual(wallet.balance, 70);
    deepStrictEqual(wallet.updatedAt, later);
    deepStrictEqual(events, [{ _tag: "WalletDebited", walletId, amount: 30, newBalance: 70 }]);
  });

  it("rejects a debit that would overdraft, carrying balance and attempted amount", () => {
    const error = WalletRootOps.debit(funded(), { amount: 101, now: later }).unwrapErr();
    deepStrictEqual(
      { ...error },
      { _tag: "WalletInsufficientFunds", walletId, balance: 100, attemptedDebit: 101 },
    );
  });

  it("allows draining the exact balance to zero", () => {
    deepStrictEqual(
      WalletRootOps.debit(funded(), { amount: 100, now: later }).unwrap().wallet.balance,
      0,
    );
  });

  it("rejects zero or negative amounts", () => {
    deepStrictEqual(
      WalletRootOps.debit(funded(), { amount: 0, now: later }).unwrapErr()._tag,
      "WalletInvalidAmount",
    );
    deepStrictEqual(
      WalletRootOps.debit(funded(), { amount: -1, now: later }).unwrapErr()._tag,
      "WalletInvalidAmount",
    );
  });

  it("rejects a debit from a freshly created wallet", () => {
    deepStrictEqual(
      WalletRootOps.debit(fresh(), { amount: 1, now: later }).unwrapErr()._tag,
      "WalletInsufficientFunds",
    );
  });
});

describe("Wallet aggregate purity", () => {
  it("credit and debit return new wallets without mutating the input", () => {
    const wallet = fresh();
    WalletRootOps.credit(wallet, { amount: 50, now: later });
    WalletRootOps.debit(wallet, { amount: 10, now: later });
    deepStrictEqual(wallet.balance, 0);
  });
});
