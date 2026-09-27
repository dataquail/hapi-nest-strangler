import { CallbackEndpoint } from "./callback.endpoint.js";
import { CreateTokenEndpoint } from "./create-token.endpoint.js";
import { DeviceApproveEndpoint } from "./device-approve.endpoint.js";
import { ListTokensEndpoint } from "./list-tokens.endpoint.js";
import { LoginEndpoint } from "./login.endpoint.js";
import { LogoutEndpoint } from "./logout.endpoint.js";
import { MeEndpoint } from "./me.endpoint.js";
import { RevokeTokenEndpoint } from "./revoke-token.endpoint.js";

export const authEndpoints = [
  LoginEndpoint,
  CallbackEndpoint,
  LogoutEndpoint,
  MeEndpoint,
  CreateTokenEndpoint,
  ListTokensEndpoint,
  RevokeTokenEndpoint,
  DeviceApproveEndpoint,
] as const;
