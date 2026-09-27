declare module "@hapipal/confidence" {
  export class Store {
    constructor(document?: unknown);
    load(document: unknown): void;
    get<T = any>(key: string, criteria?: Record<string, unknown>): T;
  }
}
