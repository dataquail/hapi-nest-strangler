import { deepStrictEqual } from "node:assert";

import { Err, Ok } from "oxide.ts";
import { describe, it } from "vitest";

import { makeHasPermissions } from "./authz.js";
import * as Check from "./check.js";
import { type CheckFor, makePolicyRegistry, type PolicyContribution } from "./policy-registry.js";
import { makeResourceResolverRegistry } from "./resource-resolver-registry.js";

type TestCaller = { readonly userId: string };
type StoreDown = { readonly _tag: "StoreDown" };
type Missing = { readonly _tag: "Missing" };
type Todo = { readonly ownerId: string };

declare module "./config.js" {
  interface AuthzConfig {
    caller: TestCaller;
    checkFailure: StoreDown;
    resourceMissing: Missing;
    action: "read" | "update";
  }
}

declare module "./resource-resolver-registry.js" {
  interface ResourceResolverMap {
    todo: { resourceType: Todo; idType: string };
    echo: { resourceType: { id: string }; idType: string; notFound: never };
  }
}

declare module "./policy-registry.js" {
  interface PolicyMap {
    todo: { read: CheckFor<"todo"> };
    echo: { read: CheckFor<"echo"> };
    platform: { update: CheckFor<"platform"> };
  }
}

const alice: TestCaller = { userId: "alice" };
const bob: TestCaller = { userId: "bob" };

const isOwner = (caller: TestCaller, todo: Todo) =>
  Promise.resolve(Ok(todo.ownerId === caller.userId));
const isAdmin = (caller: TestCaller) => Promise.resolve(Ok(caller.userId === "admin"));

const contribution: PolicyContribution = {
  todo: { read: Check.any(isOwner, isAdmin) },
  echo: { read: [isAdmin] },
  platform: { update: isAdmin },
};

const todos = new Map<string, Todo>([["t1", { ownerId: "alice" }]]);

const hasPermissions = makeHasPermissions({
  policies: makePolicyRegistry([contribution]),
  resolvers: makeResourceResolverRegistry({
    todo: (id) => {
      const todo = todos.get(id);
      return Promise.resolve(todo === undefined ? Err({ _tag: "Missing" } as const) : Ok(todo));
    },
    echo: (id) => Promise.resolve(Ok({ id })),
  }),
  forbidden: (message) => ({ _tag: "Forbidden" as const, message }),
});

describe("hasPermissions on a scoped resource", () => {
  it("resolves the resource and allows when the check passes", async () => {
    const result = await hasPermissions(alice, "todo", "read", "t1");
    deepStrictEqual(result.isOk(), true);
  });

  it("denies with the host's error when every check fails", async () => {
    const result = await hasPermissions(bob, "todo", "read", "t1");
    deepStrictEqual(result.unwrapErr(), { _tag: "Forbidden", message: "Not permitted: todo.read" });
  });

  it("reports absence with the resolver's error", async () => {
    const result = await hasPermissions(alice, "todo", "read", "missing");
    deepStrictEqual(result.unwrapErr(), { _tag: "Missing" });
  });

  it("AND-composes an array registration", async () => {
    deepStrictEqual((await hasPermissions(bob, "echo", "read", "x")).isErr(), true);
    deepStrictEqual((await hasPermissions({ userId: "admin" }, "echo", "read", "x")).isOk(), true);
  });
});

describe("hasPermissions on an unscoped resource", () => {
  it("takes no id and hands the check only the caller", async () => {
    deepStrictEqual((await hasPermissions({ userId: "admin" }, "platform", "update")).isOk(), true);
    deepStrictEqual((await hasPermissions(alice, "platform", "update")).isErr(), true);
  });
});

describe("check failures", () => {
  it("propagate a store outage from a check as the configured failure", async () => {
    const failing = makeHasPermissions({
      policies: makePolicyRegistry([
        { platform: { update: () => Promise.resolve(Err({ _tag: "StoreDown" } as const)) } },
      ]),
      resolvers: makeResourceResolverRegistry({}),
      forbidden: (message) => ({ _tag: "Forbidden" as const, message }),
    });
    deepStrictEqual((await failing(alice, "platform", "update")).unwrapErr(), {
      _tag: "StoreDown",
    });
  });

  it("refuses two contributions claiming one pair", () => {
    let threw = "";
    try {
      makePolicyRegistry([contribution, { platform: { update: isAdmin } }]);
    } catch (error) {
      threw = String(error);
    }
    deepStrictEqual(threw.includes('duplicate policy for "platform.update"'), true);
  });
});

describe("Check combinators", () => {
  it("any denies with zero checks and all allows with zero checks", async () => {
    deepStrictEqual((await Check.any()(alice, undefined)).unwrap(), false);
    deepStrictEqual((await Check.all()(alice, undefined)).unwrap(), true);
    const down: Check.Check<TestCaller, undefined, StoreDown> = async () =>
      Err({ _tag: "StoreDown" });
    const no: Check.Check<TestCaller, undefined, StoreDown> = async () => Ok(false);
    const yes: Check.Check<TestCaller, undefined, StoreDown> = async () => Ok(true);
    deepStrictEqual((await Check.any(down, yes)(alice, undefined)).isErr(), true);
    deepStrictEqual((await Check.all(down, yes)(alice, undefined)).isErr(), true);
    deepStrictEqual((await Check.all(yes, no)(alice, undefined)).unwrap(), false);
  });

  it("any short-circuits on the first true", async () => {
    const seen: Array<string> = [];
    const first = () => {
      seen.push("first");
      return Promise.resolve(Ok(true));
    };
    const second = () => {
      seen.push("second");
      return Promise.resolve(Ok(true));
    };
    await Check.any(first, second)(alice, undefined);
    deepStrictEqual(seen, ["first"]);
  });
});
