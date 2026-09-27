declare module "electrolyte" {
  type Source = (id: string) => unknown;
  export function use(source: Source): void;
  export function use(namespace: string, source: Source): void;
  export function dir(options: string | { dirname: string; extensions?: string[] }): Source;
  export function create<T = any>(id: string): Promise<T>;
}
