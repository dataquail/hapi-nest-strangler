import { CliDeviceStartEndpoint } from "./device-start.endpoint.js";
import { CliDeviceTokenEndpoint } from "./device-token.endpoint.js";

export const authCliEndpoints = [CliDeviceStartEndpoint, CliDeviceTokenEndpoint] as const;
