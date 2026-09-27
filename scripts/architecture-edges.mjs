#!/usr/bin/env node
// The architecture policy's semantics, as edges with expected verdicts.
//
// `lint:rules` proves each RULE ID still fires somewhere; this proves the POLICY
// still says what it is supposed to say — per edge for the import rules, and
// per shape for the graph rules at the bottom. The `allowed` rows are edges the
// policy permits, the `refused` rows are edges it forbids; every row was
// verified against the manifest when it was written.
//
// A row that changes verdict is either a regression or a decision. Both should
// be visible in a diff.

import {
  compileImportRules,
  decodeManifest,
  evaluateGraph,
  evaluateImportEdge,
  findManifestFile,
  lowerManifest,
  readManifestFile,
} from "@goodbones/core";
import { makeModuleResolverFake } from "@goodbones/core/testing";
import { typescriptLanguage } from "@goodbones/typescript";

const repoRoot = process.cwd();

// goodbones returns effect Results; the tag is the whole contract this script
// needs, so it reads the tag rather than adding effect as a dependency.
const isFailure = (result) => result._tag === "Failure";

// The same discovery and decode the two hosts run, so the edges are judged
// against the manifest exactly as the plugin and the CLI read it.
const read = await readManifestFile(findManifestFile(repoRoot));
const decoded = decodeManifest(read.configPath, read.manifest, { locate: read.locate });
if (isFailure(decoded)) throw decoded.failure;
const lowered = lowerManifest(decoded.success.manifest, [typescriptLanguage()]);
const compiled = compileImportRules(lowered.imports);
if (isFailure(compiled)) throw compiled.failure;
const rules = compiled.success;

const M = "packages/server/src/modules";
const P = "packages/server/src/platform";
const NPM = (name) => `node_modules/.pnpm/x/node_modules/${name}/index.js`;

// Edges the policy must REFUSE.
const REFUSED = [
  [
    "cross-module reach from a domain file",
    `${M}/alpha/domain/one/one.root.ts`,
    `${M}/beta/domain/two/two.root.ts`,
  ],
  [
    "a query handler reaching for root-ops",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.root-ops.ts`,
  ],
  [
    "a repository Live reaching for entity-ops",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/domain/one/one.entity-ops.ts`,
  ],
  [
    "a policy reaching for a repository port",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "an endpoint reaching for an ACL port",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/alpha/domain/ports/acl/beta.acl.ts`,
  ],
  [
    "an interface util reaching for a port",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "a domain file reaching for the database package",
    `${M}/alpha/domain/one/one.root.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "a domain file reaching for a non-allowed npm package",
    `${M}/alpha/domain/one/one.root.ts`,
    NPM("lodash"),
  ],
  ["a domain file reaching for Nest", `${M}/alpha/domain/one/one.root.ts`, NPM("@nestjs/common")],
  [
    "a domain file reaching for the event bus token",
    `${M}/alpha/domain/one/one.repository.ts`,
    `${P}/ddd/event-bus.ts`,
  ],
  [
    "a domain file reaching into another subdomain",
    `${M}/alpha/domain/one/one.root.ts`,
    `${M}/alpha/domain/two/two.root.ts`,
  ],
  [
    "a domain file importing a test file",
    `${M}/alpha/domain/one/one.root.ts`,
    `${M}/alpha/domain/one/one.root-ops.test.ts`,
  ],
  [
    "a command reaching for @org/database",
    `${M}/alpha/commands/do.handler.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "a command reaching for @org/contracts",
    `${M}/alpha/commands/do.handler.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  [
    "a command reaching into infrastructure",
    `${M}/alpha/commands/do.handler.ts`,
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
  ],
  [
    "a command reaching into its own queries",
    `${M}/alpha/commands/do.handler.ts`,
    `${M}/alpha/queries/find.handler.ts`,
  ],
  [
    "a command reaching for another module's surface",
    `${M}/alpha/commands/do.handler.ts`,
    `${M}/beta/beta.platform.ts`,
  ],
  [
    "a command naming a platform Live",
    `${M}/alpha/commands/do.handler.ts`,
    `${P}/notifications/smtp-mailer-live.ts`,
  ],
  [
    "a command naming the platform Mailer port",
    `${M}/alpha/commands/do.handler.ts`,
    `${P}/notifications/mailer.ts`,
  ],
  [
    "a command naming the command bus",
    `${M}/alpha/commands/do.handler.ts`,
    `${P}/cqrs/command-bus.ts`,
  ],
  [
    "a command reaching for a non-allowed npm package",
    `${M}/alpha/commands/do.handler.ts`,
    NPM("lodash"),
  ],
  [
    "a query loading an aggregate root",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a query reaching for a repository port",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "a query reaching for a specification",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.specification.ts`,
  ],
  [
    "a query reaching into commands",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "infrastructure reaching into interface",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/interface/http/get.endpoint.ts`,
  ],
  [
    "a repository Live reaching for a command",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "a repository Live reaching for a query",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/queries/find.handler.ts`,
  ],
  [
    "a repository Live reaching for the event bus",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${P}/ddd/event-bus.ts`,
  ],
  [
    "a repository Live reaching for the command bus",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${P}/cqrs/command-bus.ts`,
  ],
  [
    "an interface util reaching for an ACL port",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/domain/ports/acl/beta.acl.ts`,
  ],
  [
    "an interface util reaching for a command",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/commands/do.command.ts`,
  ],
  [
    "an interface util reaching for a module surface",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/beta/beta.platform.ts`,
  ],
  [
    "an interface util reaching for infrastructure",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/infrastructure/clients/x.client-live.ts`,
  ],
  [
    "an event adapter loading a foreign root",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/beta/domain/two/two.root.ts`,
  ],
  [
    "an event adapter reaching for a repository",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "a repository Live naming a foreign surface",
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
    `${M}/beta/beta.platform.ts`,
  ],
  [
    "a repository Live reaching foreign internals",
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
    `${M}/beta/domain/two/two.root.ts`,
  ],
  [
    "an endpoint naming a foreign surface",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/beta/beta.platform.ts`,
  ],
  [
    "an event-handler naming a foreign surface",
    `${M}/alpha/event-handlers/on-thing.handler.ts`,
    `${M}/beta/beta.platform.ts`,
  ],
  [
    "a policy loading an aggregate root",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a policy reaching for a specification",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/domain/one/one.specification.ts`,
  ],
  [
    "a policy reaching into commands",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "a policy naming the authz library directly",
    `${M}/alpha/policies/is-x.policy.ts`,
    "packages/authz/src/index.ts",
  ],
  [
    "a policy naming the command bus",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${P}/cqrs/command-bus.ts`,
  ],
  [
    "a saga reaching for a repository",
    `${M}/alpha/sagas/x.saga.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "a saga reaching for root-ops",
    `${M}/alpha/sagas/x.saga.ts`,
    `${M}/alpha/domain/one/one.root-ops.ts`,
  ],
  [
    "a saga reaching for @org/database",
    `${M}/alpha/sagas/x.saga.ts`,
    "packages/database/src/index.ts",
  ],
  ["contracts reaching the server", "packages/contracts/src/Policy.ts", `${P}/http/endpoint.ts`],
  [
    "contracts reaching the database",
    "packages/contracts/src/Policy.ts",
    "packages/database/src/index.ts",
  ],
  [
    "a View importing a spec file",
    "packages/web/features/orgs/x/x.view.tsx",
    "packages/web/features/orgs/x/x.view-model.test.ts",
  ],
  [
    "a component importing a spec file",
    "packages/components/primitives/button.tsx",
    "packages/components/primitives/button.test.tsx",
  ],
  [
    "a platform file importing a spec file",
    `${P}/http/endpoint.ts`,
    `${P}/persistence/criteria-to-sql.test.ts`,
  ],
  [
    "the CLI importing slonik",
    "packages/cli/src/main.ts",
    "node_modules/.pnpm/x/node_modules/slonik/dist/index.js",
  ],
  [
    "a server module importing the slonik driver",
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
    "node_modules/.pnpm/x/node_modules/@slonik/pg-driver/dist/index.js",
  ],
  [
    "a View reaching into services/",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/web/services/data-access/orgs.queries.ts",
  ],
  [
    "a View importing TanStack directly",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    NPM("@tanstack/react-query"),
  ],
  [
    "a ViewModel importing a View",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
  ],
  [
    "a ViewModel importing the component library",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    "packages/components/primitives/button.tsx",
  ],
  [
    "a ViewModel importing next",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    NPM("next"),
  ],
  [
    "the Model importing a feature",
    "packages/web/services/data-access/orgs.queries.ts",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
  ],
  [
    "a feature importing app/",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/web/app/layout.tsx",
  ],
  [
    "a cross-feature import",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/web/features/users/users-list/users-list.view-model.ts",
  ],
  [
    "web reaching a UI library directly",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    NPM("lucide-react"),
  ],
  [
    "web importing sonner directly (only through @org/components)",
    "packages/web/services/notification-bridge.client.tsx",
    NPM("sonner"),
  ],
  [
    "a pattern reaching a UI library",
    "packages/components/patterns/app-shell.tsx",
    "node_modules/.pnpm/x/node_modules/@radix-ui/react-dialog/dist/index.js",
  ],
  [
    "a pattern importing a feature",
    "packages/components/patterns/app-shell.tsx",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
  ],
  [
    "components importing web",
    "packages/components/primitives/button.tsx",
    "packages/web/services/data-access/orgs.queries.ts",
  ],
  [
    "cqrs runtime → a module's internals",
    `${P}/cqrs/cqrs-runtime.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  ["auth kernel → a module's internals", `${P}/auth/authz.ts`, `${M}/alpha/domain/one/one.root.ts`],
  [
    "a middleware reaching past a surface",
    `${P}/middlewares/authenticator-live.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "the guard naming a module surface",
    `${P}/middlewares/user-auth.guard.ts`,
    `${M}/alpha/alpha.platform.ts`,
  ],
  [
    "persistence → a module",
    `${P}/persistence/criteria-to-sql.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a module @Module() → the database module",
    `${M}/alpha/alpha.module.ts`,
    `${P}/database/database.module.ts`,
  ],
  [
    "a module @Module() naming another module's surface",
    `${M}/alpha/alpha.module.ts`,
    `${M}/beta/beta.platform.ts`,
  ],
  [
    "an ACL adapter reaching another module's wiring plane",
    `${M}/alpha/infrastructure/acl/beta.acl-live.ts`,
    `${M}/beta/beta.module.ts`,
  ],
  [
    "an ACL adapter bypassing the imports gateway",
    `${M}/alpha/infrastructure/acl/beta.acl-live.ts`,
    `${M}/beta/beta.exports.ts`,
  ],
  [
    "an event adapter bypassing the imports gateway",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/beta/beta.exports.ts`,
  ],
  [
    "an imports gateway reaching the wiring plane",
    `${M}/alpha/alpha.imports.ts`,
    `${M}/beta/beta.module.ts`,
  ],
  [
    "a policy reaching another module's wiring plane",
    `${M}/alpha/policies/alpha.policies.ts`,
    `${M}/beta/beta.module.ts`,
  ],
  [
    "a platform surface naming another module's platform surface",
    `${M}/alpha/alpha.platform.ts`,
    `${M}/beta/beta.platform.ts`,
  ],
  [
    "an interface util reaching for a command handler",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "a platform surface re-exporting a repository",
    `${M}/alpha/alpha.platform.ts`,
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
  ],
  [
    "a platform surface re-exporting an endpoint",
    `${M}/alpha/alpha.platform.ts`,
    `${M}/alpha/interface/http/get.endpoint.ts`,
  ],
  [
    "main.ts reaching past a surface",
    "packages/server/src/main.ts",
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "a use case naming the transaction driver",
    `${M}/alpha/commands/do.handler.ts`,
    `${P}/database/transaction-driver.ts`,
  ],
  [
    "a command naming a notifications Live",
    `${M}/alpha/commands/do.handler.ts`,
    `${P}/notifications/ses-mailer-live.ts`,
  ],
  [
    "module root file → @org/database",
    `${M}/alpha/alpha.module.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "module root file → @org/contracts",
    `${M}/alpha/alpha.module.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  ["platform surface → zod", `${M}/alpha/alpha.platform.ts`, NPM("zod")],
  [
    "event-handler → @org/database",
    `${M}/alpha/event-handlers/on.handler.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "event-handler → its own infrastructure",
    `${M}/alpha/event-handlers/on.handler.ts`,
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
  ],
  [
    "event-handler → its own queries",
    `${M}/alpha/event-handlers/on.handler.ts`,
    `${M}/alpha/queries/find.handler.ts`,
  ],
  [
    "repository Live → @org/contracts",
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  [
    "repository Live → a third-party SDK",
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
    NPM("stripe"),
  ],
  [
    "client adapter → @org/database",
    `${M}/alpha/infrastructure/clients/x.client-live.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "client adapter → an undeclared SDK",
    `${M}/alpha/infrastructure/clients/x.client-live.ts`,
    NPM("axios"),
  ],
  [
    "client adapter → a mail transport",
    `${M}/alpha/infrastructure/clients/x.client-live.ts`,
    `${P}/notifications/smtp-mailer-live.ts`,
  ],
  [
    "ACL adapter → a repository port",
    `${M}/alpha/infrastructure/acl/beta.acl-live.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "ACL adapter → @org/database",
    `${M}/alpha/infrastructure/acl/beta.acl-live.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "endpoint → its own repositories",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
  ],
  [
    "endpoint → its own root-ops",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/alpha/domain/one/one.root-ops.ts`,
  ],
  [
    "endpoint → a command handler",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "endpoint → @org/database",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "endpoint → an undeclared npm package",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    NPM("lodash"),
  ],
  [
    "endpoint → the Authenticator live",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${P}/middlewares/authenticator-live.ts`,
  ],
  [
    "util → @org/contracts",
    `${M}/alpha/interface/http/x.util.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  ["test → an undeclared npm package", `${M}/alpha/domain/one/one.root-ops.test.ts`, NPM("lodash")],
  [
    "a unit test → @org/database",
    `${M}/alpha/domain/one/one.root-ops.test.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "a use-case test → @org/database",
    `${M}/alpha/commands/do.handler.test.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "platform/ids → the contracts package",
    `${P}/ids/user-id.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  ["platform/ids → a module", `${P}/ids/user-id.ts`, `${M}/alpha/alpha.platform.ts`],
  [
    "ddd/contracts → the event bus token",
    `${P}/ddd/contracts/domain-event.ts`,
    `${P}/ddd/event-bus.ts`,
  ],
  [
    "ddd/contracts → @org/database",
    `${P}/ddd/contracts/domain-event.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "ddd/event-bus → the contracts tier",
    `${P}/ddd/event-bus.ts`,
    `${P}/ddd/contracts/specification.ts`,
  ],
  ["auth kernel → @org/database", `${P}/auth/authz.ts`, "packages/database/src/index.ts"],
  [
    "a mail transport → @org/database",
    `${P}/notifications/ses-mailer-live.ts`,
    "packages/database/src/index.ts",
  ],
  ["a mail transport → an undeclared SDK", `${P}/notifications/ses-mailer-live.ts`, NPM("mailgun")],
  [
    "persistence → a module",
    `${P}/persistence/criteria-to-sql.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a top-level platform file → a module",
    `${P}/translate-database-errors.ts`,
    `${M}/alpha/alpha.platform.ts`,
  ],
  [
    "an endpoint → the persistence helpers",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${P}/persistence/criteria-to-sql.ts`,
  ],
  [
    "common → @org/contracts",
    "packages/server/src/common/env-vars.ts",
    "packages/contracts/src/Policy.ts",
  ],
  [
    "common → @org/database",
    "packages/server/src/common/env-vars.ts",
    "packages/database/src/index.ts",
  ],
  ["common → the platform kernel", "packages/server/src/common/env-vars.ts", `${P}/ids/user-id.ts`],
  [
    "common → a module surface",
    "packages/server/src/common/env-vars.ts",
    `${M}/alpha/alpha.platform.ts`,
  ],
  ["the HTTP plumbing → a module", `${P}/http/endpoint.ts`, `${M}/alpha/alpha.platform.ts`],
  ["cqrs runtime → @org/database", `${P}/cqrs/cqrs-runtime.ts`, "packages/database/src/index.ts"],
  [
    "the database binding → a module",
    `${P}/database/database.module.ts`,
    `${M}/alpha/alpha.platform.ts`,
  ],
  [
    "anything importing main.ts",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    "packages/server/src/main.ts",
  ],
  [
    "a test importing main.ts",
    "packages/server/src/test-utils/test-server.ts",
    "packages/server/src/main.ts",
  ],
  [
    "anything importing instrumentation.ts",
    "packages/server/src/main.ts",
    "packages/server/src/instrumentation.ts",
  ],
  ["api-client reaching the server", "packages/api-client/src/client.ts", `${P}/http/endpoint.ts`],
  [
    "api-client reaching the database",
    "packages/api-client/src/client.ts",
    "packages/database/src/index.ts",
  ],
  ["the CLI reaching the server", "packages/cli/src/main.ts", `${P}/http/endpoint.ts`],
  [
    "the CLI reaching the database",
    "packages/cli/src/commands/todos.ts",
    "packages/database/src/index.ts",
  ],
  ["mcp reaching into the CLI", "packages/mcp/src/main.ts", "packages/cli/src/commands/todos.ts"],
  ["mcp reaching the server", "packages/mcp/src/main.ts", `${P}/http/endpoint.ts`],
  ["jobs reaching the server", "packages/jobs/src/jobs/cleanup.ts", `${P}/http/endpoint.ts`],
  ["jobs reaching a module", "packages/jobs/src/jobs/cleanup.ts", `${M}/todos/todos.platform.ts`],
  [
    "jobs reaching the contracts",
    "packages/jobs/src/jobs/cleanup.ts",
    "packages/contracts/src/Policy.ts",
  ],
  [
    "the database kernel reaching the contracts",
    "packages/database/src/database.ts",
    "packages/contracts/src/Policy.ts",
  ],
  ["contracts reaching an undeclared package", "packages/contracts/src/Policy.ts", NPM("lodash")],
  [
    "the event bus reaching the unit of work",
    "packages/event-bus/src/event-bus.ts",
    "packages/unit-of-work/src/unit-of-work.ts",
  ],
  ["the authz library reaching the server", "packages/authz/src/authz.ts", `${P}/auth/authz.ts`],
  [
    "acceptance reaching the web",
    "packages/acceptance/specs/add-todo.spec.ts",
    "packages/web/app/layout.tsx",
  ],
  [
    "acceptance reaching the server",
    "packages/acceptance/specs/add-todo.spec.ts",
    `${P}/http/endpoint.ts`,
  ],
  [
    "a test driver reaching the web",
    "packages/test-drivers/src/adapters/rtl/users-page-driver.ts",
    "packages/web/features/users/user-list.view.tsx",
  ],
];

// Edges the policy must ALLOW. These matter as much: a rule that refuses
// everything is as broken as one that refuses nothing.
const ALLOWED = [
  [
    "a domain-service composing two subdomains (LEGAL)",
    `${M}/alpha/domain/domain-services/x.domain-service.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a port naming a domain error (LEGAL)",
    `${M}/alpha/domain/ports/clients/x.client.ts`,
    `${M}/alpha/domain/one/one.errors.ts`,
  ],
  [
    "a command handler using root-ops (LEGAL)",
    `${M}/alpha/commands/do.handler.ts`,
    `${M}/alpha/domain/one/one.root-ops.ts`,
  ],
  ["a domain file importing zod (LEGAL)", `${M}/alpha/domain/one/one.root.ts`, NPM("zod")],
  ["a domain file importing oxide (LEGAL)", `${M}/alpha/domain/one/one.root.ts`, NPM("oxide.ts")],
  [
    "a domain file importing node:crypto (LEGAL)",
    `${M}/alpha/domain/one/one.root.ts`,
    "node:crypto",
  ],
  [
    "a domain file importing the contracts tier (LEGAL)",
    `${M}/alpha/domain/one/one.root.ts`,
    `${P}/ddd/contracts/tagged-error.ts`,
  ],
  [
    "a test file importing vitest (LEGAL)",
    `${M}/alpha/domain/one/one.root-ops.test.ts`,
    NPM("vitest"),
  ],
  [
    "a use-case test importing the unit-of-work testing entry (LEGAL)",
    `${M}/alpha/commands/do.handler.test.ts`,
    "packages/unit-of-work/src/testing.ts",
  ],
  [
    "a use-case test importing the event-bus testing entry (LEGAL)",
    `${M}/alpha/commands/do.handler.test.ts`,
    "packages/event-bus/src/testing.ts",
  ],
  ["a command using Nest's CQRS (LEGAL)", `${M}/alpha/commands/do.handler.ts`, NPM("@nestjs/cqrs")],
  [
    "a command using the UnitOfWork token (LEGAL)",
    `${M}/alpha/commands/do.handler.ts`,
    `${P}/ddd/unit-of-work.ts`,
  ],
  [
    "a command using the event bus token (LEGAL)",
    `${M}/alpha/commands/do.handler.ts`,
    `${P}/ddd/event-bus.ts`,
  ],
  ["a command using node:crypto (LEGAL)", `${M}/alpha/commands/do.handler.ts`, "node:crypto"],
  [
    "a query using a branded id (LEGAL)",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.id.ts`,
  ],
  [
    "a query using its own ACL port (LEGAL)",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/ports/acl/beta.acl.ts`,
  ],
  [
    "a query using @org/database (LEGAL)",
    `${M}/alpha/queries/find.handler.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "a query using the Database token (LEGAL)",
    `${M}/alpha/queries/find.handler.ts`,
    `${P}/database/database.ts`,
  ],
  [
    "a repository Live using its own domain (LEGAL)",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a repository Live using @org/database (LEGAL)",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "a repository Live using the persistence helpers (LEGAL)",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${P}/persistence/criteria-to-sql.ts`,
  ],
  [
    "a client adapter using a third-party SDK (LEGAL)",
    `${M}/alpha/infrastructure/clients/stripe.client-live.ts`,
    "node_modules/.pnpm/stripe@22/node_modules/stripe/esm/stripe.esm.node.js",
  ],
  [
    "a client adapter using the Mailer port (LEGAL)",
    `${M}/alpha/infrastructure/clients/x.client-live.ts`,
    `${P}/notifications/mailer.ts`,
  ],
  [
    "an endpoint using its own command message (LEGAL)",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/alpha/commands/do.command.ts`,
  ],
  [
    "an endpoint using the command bus (LEGAL)",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${P}/cqrs/command-bus.ts`,
  ],
  [
    "an endpoint using the guard (LEGAL)",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${P}/middlewares/user-auth.guard.ts`,
  ],
  [
    "an endpoint using @org/contracts (LEGAL)",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    "packages/contracts/src/api/Contracts.ts",
  ],
  [
    "a CLI endpoint using its own policies (LEGAL)",
    `${M}/alpha/interface/cli/list.endpoint.ts`,
    `${M}/alpha/policies/alpha.policies.ts`,
  ],
  [
    "an event adapter using its own command message (LEGAL)",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/alpha/commands/do.command.ts`,
  ],
  [
    "an event adapter using its own domain events (LEGAL)",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/alpha/domain/one/one.events.ts`,
  ],
  [
    "an event adapter using the event bus token (LEGAL)",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${P}/ddd/event-bus.ts`,
  ],
  [
    "a policy dispatching its own query (LEGAL)",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/queries/find.policy-query.ts`,
  ],
  [
    "a policy using its own ACL port (LEGAL)",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/domain/ports/acl/beta.acl.ts`,
  ],
  [
    "a policy using the authz vocabulary through the platform (LEGAL)",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${P}/auth/authz.ts`,
  ],
  [
    "a policy using the query bus (LEGAL)",
    `${M}/alpha/policies/alpha.policies.ts`,
    `${P}/cqrs/query-bus.ts`,
  ],
  [
    "a policy using @org/contracts (LEGAL)",
    `${M}/alpha/policies/is-x.policy.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  [
    "a saga using its own domain events (LEGAL)",
    `${M}/alpha/sagas/x.saga.ts`,
    `${M}/alpha/domain/one/one.events.ts`,
  ],
  [
    "a saga using its own command message (LEGAL)",
    `${M}/alpha/sagas/x.saga.ts`,
    `${M}/alpha/commands/do.command.ts`,
  ],
  [
    "@org/database using the driver (LEGAL)",
    "packages/database/src/database.ts",
    "node_modules/.pnpm/x/node_modules/@slonik/pg-driver/dist/index.js",
  ],
  [
    "api-client using the contracts (LEGAL)",
    "packages/api-client/src/client.ts",
    "packages/contracts/src/index.ts",
  ],
  [
    "the CLI using api-client (LEGAL)",
    "packages/cli/src/main.ts",
    "packages/api-client/src/index.ts",
  ],
  [
    "jobs using the database kernel (LEGAL)",
    "packages/jobs/src/jobs/cleanup.ts",
    "packages/database/src/index.ts",
  ],
  [
    "the unit of work using the event bus (LEGAL)",
    "packages/unit-of-work/src/unit-of-work.ts",
    "packages/event-bus/src/index.ts",
  ],
  [
    "a View using a primitive (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/components/primitives/button.tsx",
  ],
  [
    "a View using its own ViewModel (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
  ],
  [
    "a View using the wire types (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/web/services/api/types.ts",
  ],
  [
    "a ViewModel using the Model (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    "packages/web/services/data-access/orgs.queries.ts",
  ],
  [
    "a ViewModel using TanStack (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    NPM("@tanstack/react-query"),
  ],
  [
    "a ViewModel using react (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    NPM("react"),
  ],
  [
    "the Model using openapi-fetch (LEGAL)",
    "packages/web/services/api/client.shared.ts",
    NPM("openapi-fetch"),
  ],
  [
    "a primitive using radix (LEGAL)",
    "packages/components/primitives/dialog.tsx",
    "node_modules/.pnpm/x/node_modules/@radix-ui/react-dialog/dist/index.js",
  ],
  [
    "a pattern using a primitive (LEGAL)",
    "packages/components/patterns/app-shell.tsx",
    "packages/components/primitives/button.tsx",
  ],
  [
    "a platform surface re-exporting its domain (LEGAL)",
    `${M}/alpha/alpha.platform.ts`,
    `${M}/alpha/domain/one/one.id.ts`,
  ],
  [
    "a platform surface re-exporting a client fake (LEGAL)",
    `${M}/alpha/alpha.platform.ts`,
    `${M}/alpha/infrastructure/clients/x.client-fake.ts`,
  ],
  [
    "a module @Module() naming its own adapters (LEGAL)",
    `${M}/alpha/alpha.module.ts`,
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
  ],
  [
    "an imports gateway naming a foreign peer surface (LEGAL)",
    `${M}/alpha/alpha.imports.ts`,
    `${M}/beta/beta.exports.ts`,
  ],
  [
    "a module @Module() importing another module's @Module() (LEGAL)",
    `${M}/alpha/alpha.module.ts`,
    `${M}/beta/beta.module.ts`,
  ],
  [
    "an ACL adapter naming its own module's imports gateway (LEGAL)",
    `${M}/alpha/infrastructure/acl/beta.acl-live.ts`,
    `${M}/alpha/alpha.imports.ts`,
  ],
  [
    "an ACL adapter dispatching on the query bus (LEGAL)",
    `${M}/alpha/infrastructure/acl/beta.acl-live.ts`,
    `${P}/cqrs/query-bus.ts`,
  ],
  [
    "a handler list naming the span-attribute type (LEGAL)",
    `${M}/alpha/alpha.command-handlers.ts`,
    `${P}/cqrs/command-bus.ts`,
  ],
  [
    "main.ts using AppModule (LEGAL)",
    "packages/server/src/main.ts",
    `${P}/modules/application-modules.ts`,
  ],
  [
    "the cqrs runtime using a module surface (LEGAL)",
    `${P}/cqrs/cqrs-runtime.ts`,
    `${M}/alpha/alpha.platform.ts`,
  ],
  [
    "the cqrs runtime using the event-bus factory (LEGAL)",
    `${P}/cqrs/cqrs-runtime.ts`,
    "packages/event-bus/src/index.ts",
  ],
  [
    "the Authenticator live using the auth module surface (LEGAL)",
    `${P}/middlewares/authenticator-live.ts`,
    `${M}/auth/auth.platform.ts`,
  ],
  [
    "the guard using the Authenticator port (LEGAL)",
    `${P}/middlewares/user-auth.guard.ts`,
    `${P}/auth/authenticator.ts`,
  ],
  [
    "the test server using a module surface (LEGAL)",
    "packages/server/src/test-utils/test-server.ts",
    `${M}/billing/billing.platform.ts`,
  ],
  [
    "an endpoint test using the test runtime (LEGAL)",
    `${M}/alpha/interface/http/get.endpoint.integration.test.ts`,
    "packages/server/src/test-utils/server-test-runtime.ts",
  ],
  [
    "acceptance using a Playwright driver (LEGAL)",
    "packages/acceptance/specs/add-user.spec.ts",
    "packages/test-drivers/src/adapters/playwright/users-page-driver.ts",
  ],
  [
    "a web integration test using an RTL driver (LEGAL)",
    "packages/web/features/users/__tests__/create-user.integration.test.tsx",
    "packages/test-drivers/src/adapters/rtl/users-page-driver.ts",
  ],
];

// The graph rules, over small synthetic graphs. A per-edge row asks whether one
// import is refused; these ask what a whole shape means — a route through two
// files, a route that steps onto the mediating tier, a file nothing reaches.
// Each row names the rule expected to report, or `null` for a shape the rules
// must stay quiet on; a fourth element lists files that take part in the graph
// with no edge of their own.
const GRAPH = [
  [
    "a domain file reaching a repository Live through a sibling",
    "domain-reaches-no-adapter",
    [
      [`${M}/alpha/domain/one/one.root.ts`, `${M}/alpha/domain/one/one.specification.ts`],
      [
        `${M}/alpha/domain/one/one.specification.ts`,
        `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
      ],
    ],
  ],
  [
    "a domain test reaching a repository fake (LEGAL)",
    null,
    [
      [
        `${M}/alpha/domain/one/one.root-ops.test.ts`,
        `${M}/alpha/infrastructure/repositories/one.repository-fake.ts`,
      ],
    ],
  ],
  [
    "a command reaching an endpoint through its message",
    "use-cases-reach-no-adapter",
    [
      [`${M}/alpha/commands/do.handler.ts`, `${M}/alpha/commands/do.command.ts`],
      [`${M}/alpha/commands/do.command.ts`, `${M}/alpha/interface/http/get.endpoint.ts`],
    ],
  ],
  [
    "a command reaching a port that reaches nothing (LEGAL)",
    null,
    [[`${M}/alpha/commands/do.handler.ts`, `${M}/alpha/domain/one/one.repository.ts`]],
  ],
  [
    "the platform reaching a module's Nest module past its surface",
    "platform-reaches-modules-only-through-barrels",
    [[`${P}/cqrs/cqrs-runtime.ts`, `${M}/alpha/alpha.module.ts`]],
  ],
  [
    "the platform reaching a module's Nest module through its surface (LEGAL)",
    null,
    [
      [`${P}/cqrs/cqrs-runtime.ts`, `${M}/alpha/alpha.platform.ts`],
      [`${M}/alpha/alpha.platform.ts`, `${M}/alpha/alpha.module.ts`],
    ],
  ],
  [
    "web reaching the server through the contracts package",
    "web-never-reaches-the-server",
    [
      ["packages/web/services/api/client.shared.ts", "packages/contracts/src/Policy.ts"],
      ["packages/contracts/src/Policy.ts", "packages/server/src/common/env-vars.ts"],
    ],
  ],
  [
    "web reaching the contracts package (LEGAL)",
    null,
    [["packages/web/services/api/client.shared.ts", "packages/contracts/src/Policy.ts"]],
  ],
  [
    "the contracts package reaching the database kernel",
    "contracts-reach-nothing",
    [["packages/contracts/src/Policy.ts", "packages/database/src/index.ts"]],
  ],
  [
    "two platform files importing each other",
    "no-cycles",
    [
      [`${P}/http/endpoint.ts`, `${P}/http/http-problem.ts`],
      [`${P}/http/http-problem.ts`, `${P}/http/endpoint.ts`],
    ],
  ],
  [
    "a domain file nothing imports",
    "no-orphans",
    [[`${M}/alpha/commands/do.handler.ts`, `${M}/alpha/domain/one/one.repository.ts`]],
    [`${M}/alpha/domain/one/one.errors.ts`],
  ],
  [
    "a repository fake nothing imports (LEGAL)",
    null,
    [[`${M}/alpha/commands/do.handler.ts`, `${M}/alpha/domain/one/one.repository.ts`]],
    [`${M}/alpha/infrastructure/repositories/one.repository-fake.ts`],
  ],
];

// The lowered graph rules carry their patterns as regex sources; the evaluator
// takes them compiled.
const regexes = (patterns = []) => patterns.map((source) => new RegExp(source));
const graphRules = {
  cycles: lowered.graph.cycles.map((rule) => ({
    ...rule,
    within: regexes(rule.within),
    withinNot: regexes(rule.withinNot),
  })),
  orphans: lowered.graph.orphans.map((rule) => ({
    ...rule,
    within: regexes(rule.within),
    withinNot: regexes(rule.withinNot),
    entry: regexes(rule.entry),
  })),
  reach: lowered.graph.reach.map((rule) => ({
    ...rule,
    from: regexes(rule.from),
    fromNot: regexes(rule.fromNot),
    to: regexes(rule.to),
    toNot: regexes(rule.toNot),
    via: regexes(rule.via),
  })),
};

const graphOf = (edges, extraFiles = []) => {
  const files = new Set(extraFiles);
  const adjacency = new Map();
  for (const [from, to] of edges) {
    files.add(from);
    files.add(to);
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  }
  return { files: [...files].sort(), edges: adjacency };
};

const refuses = (from, to) => {
  const outcome = evaluateImportEdge(rules, makeModuleResolverFake({ "@probe": to }), {
    importer: from,
    specifier: "@probe",
  });
  return !isFailure(outcome) && outcome.success.length > 0;
};

let wrong = 0;
const check = (label, from, to, expected) => {
  const actual = refuses(from, to);
  const ok = actual === expected;
  if (!ok) wrong += 1;
  process.stdout.write(
    `${ok ? "  " : "!!"} ${expected ? "refuse" : "allow "} ${actual === expected ? "ok " : "GOT " + (actual ? "refuse" : "allow")}  ${label}\n`,
  );
};

for (const [label, from, to] of REFUSED) check(label, from, to, true);
for (const [label, from, to] of ALLOWED) check(label, from, to, false);

let graphWrong = 0;
for (const [label, expected, edges, extraFiles = []] of GRAPH) {
  // The origin of a synthetic route is reached by nothing, so the orphans rule
  // is read only on the files a row lists as taking part without an edge.
  const names = [
    ...new Set(
      evaluateGraph(graphRules, graphOf(edges, extraFiles))
        .filter((v) => v.ruleName !== "no-orphans" || extraFiles.includes(v.file))
        .map((v) => v.ruleName),
    ),
  ];
  const ok = expected === null ? names.length === 0 : names.includes(expected);
  if (!ok) graphWrong += 1;
  process.stdout.write(
    `${ok ? "  " : "!!"} ${expected === null ? "quiet " : "report"} ${ok ? "ok " : `GOT ${names.length === 0 ? "quiet" : names.join(",")}`}  ${label}\n`,
  );
}

const total = REFUSED.length + ALLOWED.length;
process.stdout.write(
  wrong === 0
    ? `\nAll ${total} architecture edges hold (${REFUSED.length} refused, ${ALLOWED.length} allowed).\n`
    : `\n${wrong} of ${total} architecture edges changed verdict.\n`,
);
process.stdout.write(
  graphWrong === 0
    ? `All ${GRAPH.length} graph shapes hold.\n`
    : `${graphWrong} of ${GRAPH.length} graph shapes changed verdict.\n`,
);
process.exitCode = wrong === 0 && graphWrong === 0 ? 0 : 1;
