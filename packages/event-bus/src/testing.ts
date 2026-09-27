import type * as Event from "./event.js";
import { type EventBus, makeEventBus } from "./event-bus.js";

/**
 * A bus that records what was dispatched and delivers to nothing. What a
 * use-case unit test wires when it asserts on events rather than on reactions.
 */
export type RecordingEventBus = EventBus & {
  readonly dispatched: () => ReadonlyArray<Event.Base>;
  readonly byTag: <D extends Event.Any>(definition: D) => ReadonlyArray<Event.Type<D>>;
  readonly clear: () => void;
};

export const makeRecordingEventBus = (): RecordingEventBus => {
  const recorded: Array<Event.Base> = [];
  const inner = makeEventBus();
  return {
    ...inner,
    dispatch: (events) => {
      for (const event of events) recorded.push(event);
      return Promise.resolve();
    },
    subscribe: () => {},
    subscribeAfterCommit: () => {},
    dispatched: () => [...recorded],
    byTag: (definition) => recorded.filter((event) => definition.is(event)) as never,
    clear: () => {
      recorded.length = 0;
    },
  };
};
