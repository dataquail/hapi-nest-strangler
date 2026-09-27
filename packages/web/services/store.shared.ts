// The smallest possible external store: a value, a setter, and subscribers.
// `useSyncExternalStore` reads it in a bridge; a ViewModel or a test writes it.

export type Store<A> = {
  readonly get: () => A;
  readonly set: (value: A) => void;
  readonly subscribe: (listener: () => void) => () => void;
};

export const makeStore = <A>(initial: A): Store<A> => {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next) => {
      value = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
