// The metadata keys @nestjs/cqrs stamps with @CommandHandler / @QueryHandler.
// Not exported from its root; a handler missing them fails this check loudly.
const COMMAND_HANDLER_METADATA = "__commandHandler__";
const QUERY_HANDLER_METADATA = "__queryHandler__";

type Ctor = abstract new (...args: never) => unknown;

const handlerFor = (metadataKey: string, handler: Ctor): Ctor | undefined =>
  Reflect.getMetadata(metadataKey, handler) as Ctor | undefined;

/**
 * Boot completeness, the way the typed bus used to refuse to build: every
 * message a module declares must be answered by exactly one of the handlers it
 * registers. Each module's `*.command-handlers.ts` test calls this.
 */
export const assertHandlersCover = (
  kind: "command" | "query",
  messages: ReadonlyArray<Ctor>,
  handlers: ReadonlyArray<Ctor>,
): void => {
  const metadataKey = kind === "command" ? COMMAND_HANDLER_METADATA : QUERY_HANDLER_METADATA;
  const handled = new Map<Ctor, Array<string>>();
  for (const handler of handlers) {
    const message = handlerFor(metadataKey, handler);
    if (message === undefined) {
      throw new Error(
        `${handler.name} carries no @${kind === "command" ? "CommandHandler" : "QueryHandler"} decorator`,
      );
    }
    handled.set(message, [...(handled.get(message) ?? []), handler.name]);
  }
  const unrouted = messages.filter((message) => !handled.has(message)).map((m) => m.name);
  if (unrouted.length > 0) {
    throw new Error(`Unroutable ${kind}s: ${unrouted.join(", ")}`);
  }
  const duplicates = [...handled.entries()].filter(([, names]) => names.length > 1);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate ${kind} handlers: ${duplicates.map(([m, names]) => `${m.name} ← ${names.join(", ")}`).join("; ")}`,
    );
  }
  const undeclared = [...handled.keys()]
    .filter((message) => !messages.includes(message))
    .map((m) => m.name);
  if (undeclared.length > 0) {
    throw new Error(`Handlers for ${kind}s the module does not declare: ${undeclared.join(", ")}`);
  }
};
