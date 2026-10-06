// The faults, probes and controls of experiment 1 (../01-seeded-faults.md).
// Every edit is an exact-anchor replacement, a stored patch, or a git command;
// each throws if it cannot apply, so a fault that silently fails is an error.

const SERVICE = "packages/legacy-api/src/application/billing/billing-service.ts";
const ROUTES = "packages/legacy-api/src/application/billing/billing-routes.ts";
const CONTRACT = "packages/contracts/src/api/BillingContract.ts";
const MODELS = "packages/legacy-api/src/application/models.ts";
const SUBSCRIPTION_MODEL = "packages/legacy-api/src/application/billing/subscription-model.ts";
const NEST = "packages/server/src/modules/billing";
const LEDGERS = ".architecture-campaigns";

const CANCEL_ANCHOR = "  // Cancels upstream first, then flips the local status;";

// F1/F1b: a new legacy write that emits nothing for the mirror.
const addUnmirroredWrite = (ctx) =>
  ctx.replace(
    SERVICE,
    CANCEL_ANCHOR,
    `  async touchSubscription(organization: any) {
    await this.knex("subscriptions")
      .where({ organization_id: organization.get("id") })
      .update({ updated_at: new Date() });
  }

${CANCEL_ANCHOR}`,
  );

// A layer's code without its ledger changes, so the ledgers stay the branch's.
const applyLayerCode = (ctx, commit) =>
  ctx.sh(`git diff ${commit}^ ${commit} -- . ':!${LEDGERS}' | git apply --index`);

// F6: the start mirror moved above the insert it announces.
const emitMirrorBeforeInsert = (ctx) => {
  const insert = `    await this.knex("subscriptions").insert(row);\n`;
  const emit = `    this.server.events.emit(mirrorEvents.SUBSCRIPTION_STARTED, {
      id: row.id,
      organizationId: row.organization_id,
      stripeCustomerId: row.stripe_customer_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      status: row.status,
      currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    });\n`;
  ctx.replace(SERVICE, insert + emit, emit + insert);
};

const concedeNewHoldout = (plant, objective) => (ctx, record) => {
  plant(ctx);
  ctx.run(record, "clear", "pnpm -s campaigns:clear");
  ctx.run(
    record,
    "concede",
    `pnpm -s exec architecture objectives concede strangle-hapi/${objective} --reason "temporary"`,
  );
};

const concessionReadback = [
  ["sector record", `cat ${LEDGERS}/strangle-hapi/sectors/billing.json`],
  ["status --sector", "pnpm -s exec architecture campaigns status --sector billing packages"],
];

const faults = [
  {
    id: "F1",
    kind: "fault",
    branch: "billing-mirror-cancel",
    apply: addUnmirroredWrite,
  },
  {
    id: "F1b",
    kind: "fault",
    branch: "billing-backfill",
    apply: addUnmirroredWrite,
  },
  {
    id: "F2",
    kind: "fault",
    branch: "billing-serve-read",
    apply: (ctx) => {
      ctx.replace(
        CONTRACT,
        `      errors: [Forbidden, BadGateway, SubscriptionNotFoundError, ServiceUnavailable],
      security: "session",
    }),
  },
});`,
        `      errors: [Forbidden, BadGateway, SubscriptionNotFoundError, ServiceUnavailable],
      security: "session",
    }),
    listInvoices: defineRoute({
      method: "get",
      path: "/orgs/{orgId}/billing/invoices",
      operationId: "billing.listInvoices",
      params: OrgParams,
      success: { status: 200, schema: InvoiceList },
      errors: [Forbidden, ServiceUnavailable],
      security: "session",
    }),
  },
});`,
      );
      ctx.replace(
        CONTRACT,
        `const OrgParams = z.object({ orgId: OrganizationId });`,
        `export const InvoiceList = z
  .array(z.object({ id: z.string(), amountCents: z.number().int(), issuedAt: z.iso.datetime() }))
  .meta({ id: "InvoiceList" });
export type InvoiceList = z.infer<typeof InvoiceList>;

const OrgParams = z.object({ orgId: OrganizationId });`,
      );
      ctx.replace(
        ROUTES,
        `    {
      method: "DELETE",
      path: "/orgs/{orgId}/billing/subscriptions/current",`,
        `    {
      method: "GET",
      path: "/orgs/{orgId}/billing/invoices",
      handler: () => [],
      options: {
        tags: ["api"],
        description: "The organization's invoices",
        auth: "session",
        ext: { onPreHandler: [{ method: can(actionConstants.MANAGE_BILLING, "params.orgId") }] },
        validate: { params: orgParams },
      },
    },
    {
      method: "DELETE",
      path: "/orgs/{orgId}/billing/subscriptions/current",`,
      );
      // What a teammate adding a contract route runs next.
      ctx.sh("pnpm -s contracts:generate");
    },
  },
  {
    id: "F3",
    kind: "fault",
    branch: "billing-data-moved",
    apply: (ctx) => {
      ctx.checkoutFrom("campaign/billing-routes-moved", SUBSCRIPTION_MODEL);
      ctx.replace(
        MODELS,
        `import sessionModel from "./auth/session-model";\n`,
        `import sessionModel from "./auth/session-model";\nimport subscriptionModel from "./billing/subscription-model";\n`,
      );
      ctx.replace(
        MODELS,
        `  { name: "invitation", model: invitationModel },\n];`,
        `  { name: "invitation", model: invitationModel },\n  { name: "subscription", model: subscriptionModel },\n];`,
      );
    },
  },
  {
    id: "F4",
    kind: "fault",
    branch: "billing-backfill",
    apply: (ctx) => {
      applyLayerCode(ctx, "0fa988d");
    },
  },
  {
    id: "F5",
    kind: "fault",
    branch: "billing-serve-writes-nest",
    apply: (ctx) => ctx.patch("F5"),
  },
  {
    id: "F6",
    kind: "fault",
    branch: "billing-mirror-start",
    apply: emitMirrorBeforeInsert,
  },
  {
    id: "F7",
    kind: "fault",
    branch: "billing-serve-read",
    // R3: a clear on the regressed tree must leave the served-phase entries held.
    after: [
      ["clear", "pnpm -s campaigns:clear"],
      ["ledger diff after clear", `git diff HEAD -- ${LEDGERS}`],
    ],
    apply: (ctx) => {
      ctx.replace(
        SERVICE,
        `import { problem } from "../../lib/problem";\n`,
        `import { problem } from "../../lib/problem";\nimport type OrganizationService = require("../organization/organization-service");\n`,
      );
      ctx.replace(
        SERVICE,
        `  private server: Server;

  constructor(bookshelf: Bookshelf, stripeGateway: StripeGateway, server: Server) {
    this.bookshelf = bookshelf;
    this.stripeGateway = stripeGateway;
    this.server = server;
  }`,
        `  private server: Server;
  private organizationService: OrganizationService | undefined;

  constructor(
    bookshelf: Bookshelf,
    stripeGateway: StripeGateway,
    server: Server,
    organizationService?: OrganizationService,
  ) {
    this.bookshelf = bookshelf;
    this.stripeGateway = stripeGateway;
    this.server = server;
    this.organizationService = organizationService;
  }`,
      );
      ctx.replace(
        SERVICE,
        `    if (!row) throw subscriptionNotFound(organization.get("id"));
    await this.stripeGateway.cancelSubscription({`,
        `    if (!row) throw subscriptionNotFound(organization.get("id"));
    if (organization.isDeleted?.()) {
      await this.organizationService?.compensateWallet(organization.get("id"));
    }
    await this.stripeGateway.cancelSubscription({`,
      );
      ctx.replace(
        SERVICE,
        `BillingService["@require"] = ["bookshelf", "billing/stripe-gateway", "server"];`,
        `BillingService["@require"] = [
  "bookshelf",
  "billing/stripe-gateway",
  "server",
  "organization/organization-service",
];`,
      );
    },
  },
  {
    id: "F8",
    kind: "fault",
    branch: "billing-retire-internal",
    apply: (ctx) =>
      ctx.write(
        SERVICE,
        `import type Bookshelf from "bookshelf";
import type { Knex } from "knex";

// An admin repair tool: re-creates a subscription row by hand.
class BillingService {
  public bookshelf: Bookshelf;

  constructor(bookshelf: Bookshelf) {
    this.bookshelf = bookshelf;
  }

  // @types/bookshelf is typed against knex 0.21; the instance is knex 2.
  get knex(): Knex {
    return this.bookshelf.knex as unknown as Knex;
  }

  async repairSubscription(row: {
    id: string;
    organization_id: string;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    status: string;
  }) {
    const now = new Date();
    await this.knex("subscriptions").insert({
      ...row,
      current_period_end: null,
      created_at: now,
      updated_at: now,
    });
  }
}

BillingService["@singleton"] = true;
BillingService["@require"] = ["bookshelf"];

export = BillingService;
`,
      ),
  },
  {
    id: "F9",
    kind: "fault",
    branch: "billing-serve-writes-nest",
    apply: (ctx) => {
      const handler = `${NEST}/commands/start-subscription.handler.ts`;
      ctx.replace(
        handler,
        `import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";\n`,
        `import { SubscriptionSpecifications } from "../domain/subscription/subscription.specification.js";\nimport type { BillingGatewayLive } from "../infrastructure/clients/billing-gateway.client-live.js";\n`,
      );
      // Named as the field's type: used, boots unchanged, so the only complaint is the boundary.
      ctx.replace(
        handler,
        `    @Inject(BillingGateway) private readonly gateway: BillingGateway,`,
        `    @Inject(BillingGateway) private readonly gateway: BillingGatewayLive,`,
      );
    },
  },
  {
    id: "F10",
    kind: "fault",
    branch: "billing-serve-writes-nest",
    apply: (ctx) => {
      const handler = `${NEST}/commands/record-subscription.handler.ts`;
      const test = `${NEST}/commands/record-subscription.handler.test.ts`;
      ctx.replace(
        handler,
        `import { SubscriptionRepository }`,
        `import { BillingGateway } from "../domain/ports/clients/billing-gateway.client.js";\nimport { SubscriptionRepository }`,
      );
      ctx.replace(
        handler,
        `    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
  ) {}`,
        `    @Inject(UnitOfWork) private readonly unitOfWork: UnitOfWork,
    @Inject(BillingGateway) private readonly gateway: BillingGateway,
  ) {}`,
      );
      ctx.replace(
        handler,
        `    return this.unitOfWork.run<RecordSubscriptionResult>(async () => {
      const { subscription }`,
        `    return this.unitOfWork.run<RecordSubscriptionResult>(async () => {
      await this.gateway.createCustomer({ organizationId: payload.organizationId });
      await this.gateway.createSubscription({ stripeCustomerId: payload.stripeCustomerId });
      const { subscription }`,
      );
      ctx.replace(
        test,
        `import { SubscriptionRepositoryFake }`,
        `import { BillingGatewayFake } from "../infrastructure/clients/billing-gateway.client-fake.js";\nimport { SubscriptionRepositoryFake }`,
      );
      ctx.replace(
        test,
        `new RecordSubscriptionHandler(subscriptions, PassThroughUnitOfWork);`,
        `new RecordSubscriptionHandler(
      subscriptions,
      PassThroughUnitOfWork,
      new BillingGatewayFake(),
    );`,
      );
      ctx.replace(
        test,
        `      new SubscriptionRepositoryFake(),
      PassThroughUnitOfWork,
    );`,
        `      new SubscriptionRepositoryFake(),
      PassThroughUnitOfWork,
      new BillingGatewayFake(),
    );`,
      );
    },
  },
  {
    id: "F11",
    kind: "fault",
    branch: "billing-backfill",
    apply: concedeNewHoldout(addUnmirroredWrite, "writes-not-mirrored"),
    after: concessionReadback,
  },
  // F11 across an attested phase: billing is served with backfilled attested, and a
  // mirrored-phase concession falls below the attestation, which revokes it. F6's edit, because
  // writes-not-mirrored closes at served and mirror-before-write does not.
  {
    id: "F11b",
    kind: "fault",
    branch: "billing-attest",
    apply: concedeNewHoldout(emitMirrorBeforeInsert, "mirror-before-write"),
    after: concessionReadback,
  },
];

const probes = [
  {
    id: "P1",
    kind: "probe",
    branch: "billing-retire-internal",
    gates: ["G1", "G2"],
    apply: (ctx) => {
      applyLayerCode(ctx, "3ed1804");
    },
  },
  {
    id: "P2",
    kind: "probe",
    branch: "billing-backfill",
    gates: [],
    apply: (ctx, record) => {
      ctx.run(
        record,
        "attest",
        `pnpm -s exec architecture campaigns attest billing backfilled --reason x`,
      );
      ctx.run(record, "clear", "pnpm -s campaigns:clear");
    },
  },
  {
    id: "P3",
    kind: "probe",
    branch: "billing-serve-read",
    gates: [],
    apply: (ctx, record) => {
      const text = `${"0123456789".repeat(59)}END-OF-600`;
      ctx.run(record, "note", `pnpm -s exec architecture campaigns note billing "${text}"`);
      const sector = JSON.parse(ctx.read(`${LEDGERS}/strangle-hapi/sectors/billing.json`));
      const notes = JSON.stringify(sector).match(/0123456789[0-9A-Z-]*/g) ?? [];
      record.observation = {
        written: text.length,
        stored: notes.map((n) => n.length),
        endsWithMarker: notes.map((n) => n.endsWith("END-OF-600")),
      };
    },
  },
  {
    id: "P4",
    kind: "probe",
    branch: "billing-serve-read",
    gates: [],
    apply: (ctx, record) => {
      ctx.run(record, "campaigns", "pnpm -s campaigns");
      ctx.run(
        record,
        "status --json",
        "pnpm -s exec architecture campaigns status --json packages",
      );
      ctx.run(record, "campaigns billing", "pnpm -s exec architecture campaigns billing packages");
      ctx.run(record, "campaigns --json", "pnpm -s exec architecture campaigns --json packages");
      ctx.run(
        record,
        "status --sector",
        "pnpm -s exec architecture campaigns status --sector billing packages",
      );
      ctx.run(
        record,
        "status --sector --json",
        "pnpm -s exec architecture campaigns status --sector billing --json packages",
      );
    },
  },
  {
    id: "P5",
    kind: "probe",
    branch: "billing-attest",
    gates: ["G1", "G2", "G3"],
    apply: (ctx) => {
      const text = ctx.read(SERVICE);
      const count = (text.match(/\bapplied\b/g) ?? []).length;
      if (count < 2) throw new Error(`expected the applied const, found ${count} uses`);
      ctx.write(SERVICE, text.replace(/\bapplied\b/g, "outcome"));
    },
  },
  // P6 is F4 by definition; it is read off F4's row.
];

const controlBranches = [...new Set([...faults, ...probes].map((e) => e.branch))];
const controls = controlBranches.map((branch) => ({
  id: `C-${branch.replace(/^billing-/, "")}`,
  kind: "control",
  branch,
}));

export const entries = [...controls, ...faults, ...probes];
