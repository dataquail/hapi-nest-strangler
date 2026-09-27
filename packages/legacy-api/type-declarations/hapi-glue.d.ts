declare module "@hapi/glue" {
  import type { Plugin, Server, ServerOptions } from "@hapi/hapi";

  export interface PluginObject {
    plugin: Plugin<any> | { plugin: Plugin<any> };
    options?: Record<string, unknown>;
  }

  export interface Manifest {
    server?: ServerOptions;
    register?: { plugins: PluginObject[]; options?: Record<string, unknown> };
  }

  export function compose(manifest: Manifest, options?: { relativeTo?: string }): Promise<Server>;
}
