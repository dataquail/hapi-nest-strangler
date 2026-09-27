import * as CliAuthContract from "./api/CliAuthContract.js";
import * as CliOrganizationContract from "./api/CliOrganizationContract.js";
import * as CliTodosContract from "./api/CliTodosContract.js";
import type { ContractGroup } from "./Route.js";

/** The machine-facing API the CLI and MCP server use with a bearer API token. */
export const CliApi: ReadonlyArray<ContractGroup> = [
  CliAuthContract.DeviceGroup,
  CliOrganizationContract.Group,
  CliTodosContract.Group,
];
