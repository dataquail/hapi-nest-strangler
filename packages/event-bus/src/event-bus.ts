import { SpanStatusCode, trace, type Tracer } from "@opentelemetry/api";

import type { DeferralSink, ReactionBoundary } from "./deferral.js";
import type * as Event from "./event.js";
import type { UnhandledFailures } from "./unhandled-failures.js";

export type EventHandler<E extends Event.Base = Event.Base> = (event: E) => Promise<void>;

export type EventStream = AsyncIterable<Event.Base> & { readonly close: () => void };

export type EventBus = {
  /** Hands the events to the deferral sink, then runs every immediate handler in order, in the caller's async context. */
  readonly dispatch: (events: ReadonlyArray<Event.Base>) => Promise<void>;
  /** Immediate: runs inside the publisher's boundary; a rejection propagates and rolls the publisher back. */
  readonly subscribe: <D extends Event.Any>(
    definition: D,
    handler: (event: Event.Type<D>) => Promise<void>,
  ) => void;
  /** Eventual: runs once the publisher's boundary has completed, isolated, each through its own boundary. */
  readonly subscribeAfterCommit: <D extends Event.Any>(
    definition: D,
    handler: (event: Event.Type<D>) => Promise<void>,
  ) => void;
  /** Post-commit, never awaited — the saga substrate. */
  readonly stream: (tags: ReadonlyArray<string>) => EventStream;
  /** Runs the after-commit handlers for these events; the unit of work calls this after it commits. */
  readonly drain: (events: ReadonlyArray<Event.Base>, boundary?: ReactionBoundary) => Promise<void>;
  readonly broadcast: (events: ReadonlyArray<Event.Base>) => void;
  /** Installed by the unit of work. Once. */
  readonly attachDeferralSink: (sink: DeferralSink) => void;
};

export type EventBusOptions = {
  readonly spanAttributes?: Event.SpanAttributes;
  readonly unhandledFailures?: UnhandledFailures;
  readonly tracer?: Tracer;
};

const inline: ReactionBoundary = (reaction) => reaction();

type Registry = Map<string, Array<EventHandler>>;

const register = (registry: Registry, tag: string, handler: EventHandler): void => {
  registry.set(tag, [...(registry.get(tag) ?? []), handler]);
};

type Waiter = (value: IteratorResult<Event.Base>) => void;

const makeStream = (
  wanted: ReadonlySet<string>,
  unsubscribe: (push: (event: Event.Base) => void) => void,
): { readonly stream: EventStream; readonly push: (event: Event.Base) => void } => {
  const buffer: Array<Event.Base> = [];
  const waiters: Array<Waiter> = [];
  let closed = false;

  const push = (event: Event.Base): void => {
    if (closed || !wanted.has(event._tag)) return;
    const waiter = waiters.shift();
    if (waiter !== undefined) {
      waiter({ value: event, done: false });
      return;
    }
    buffer.push(event);
  };

  const close = (): void => {
    if (closed) return;
    closed = true;
    unsubscribe(push);
    for (const waiter of waiters.splice(0)) {
      waiter({ value: undefined, done: true });
    }
  };

  const stream: EventStream = {
    close,
    [Symbol.asyncIterator]: () => ({
      next: () => {
        const buffered = buffer.shift();
        if (buffered !== undefined) {
          return Promise.resolve({ value: buffered, done: false });
        }
        if (closed) {
          return Promise.resolve({ value: undefined, done: true });
        }
        return new Promise<IteratorResult<Event.Base>>((resolve) => {
          waiters.push(resolve);
        });
      },
      return: () => {
        close();
        return Promise.resolve({ value: undefined, done: true });
      },
    }),
  };

  return { stream, push };
};

export const makeEventBus = (options: EventBusOptions = {}): EventBus => {
  const immediate: Registry = new Map();
  const afterCommit: Registry = new Map();
  const extractors: Event.SpanAttributes = options.spanAttributes ?? {};
  const tracer = options.tracer ?? trace.getTracer("@org/event-bus");
  const subscribers = new Set<(event: Event.Base) => void>();
  let sink: DeferralSink | undefined = undefined;

  const broadcast: EventBus["broadcast"] = (events) => {
    for (const event of events) {
      for (const push of subscribers) push(event);
    }
  };

  const drain: EventBus["drain"] = async (events, boundary = inline) => {
    broadcast(events);
    for (const event of events) {
      const handlers = afterCommit.get(event._tag) ?? [];
      for (const [index, handler] of handlers.entries()) {
        await tracer.startActiveSpan(`event.afterCommit.${event._tag}`, async (span) => {
          try {
            await boundary(() => handler(event));
          } catch (cause) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            options.unhandledFailures?.report({
              source: `${event._tag}#${String(index)}`,
              kind: "after-commit-handler",
              eventTag: event._tag,
              cause,
            });
          } finally {
            span.end();
          }
        });
      }
    }
  };

  const dispatch: EventBus["dispatch"] = async (events) => {
    if (sink !== undefined) sink.defer(events);

    for (const event of events) {
      const handlers = immediate.get(event._tag) ?? [];
      const extractor = extractors[event._tag];
      const extracted = extractor === undefined ? {} : extractor(event as never);
      await tracer.startActiveSpan(
        `event.${event._tag}`,
        {
          attributes: {
            "event.tag": event._tag,
            "event.handler.count": handlers.length,
            ...extracted,
          },
        },
        async (span) => {
          try {
            for (const handler of handlers) {
              await handler(event);
            }
          } catch (cause) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            throw cause;
          } finally {
            span.end();
          }
        },
      );
    }

    if (sink === undefined) await drain(events);
  };

  return {
    dispatch,
    drain,
    broadcast,
    subscribe: (definition, handler) => {
      register(immediate, definition.tag, handler as EventHandler);
    },
    subscribeAfterCommit: (definition, handler) => {
      register(afterCommit, definition.tag, handler as EventHandler);
    },
    stream: (tags) => {
      const { push, stream } = makeStream(new Set(tags), (p) => subscribers.delete(p));
      subscribers.add(push);
      return stream;
    },
    attachDeferralSink: (next) => {
      if (sink !== undefined) {
        throw new Error("EventBus: a DeferralSink is already attached");
      }
      sink = next;
    },
  };
};
