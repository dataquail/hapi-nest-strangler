import type Bookshelf from "bookshelf";

import apiTokenModel from "./auth/api-token-model";
import authIdentityModel from "./auth/auth-identity-model";
import deviceGrantModel from "./auth/device-grant-model";
import sessionModel from "./auth/session-model";
import invitationModel from "./organization/invitation-model";
import membershipModel from "./organization/membership-model";
import organizationModel from "./organization/organization-model";
import organizationRoleModel from "./organization/organization-role-model";
import roleModel from "./user/role-model";
import userModel from "./user/user-model";

export type ModelFactory = (bookshelf: Bookshelf) => Record<string, unknown>;

// The bookshelf registry: every model, by the string name the rest of the
// application uses to reach it (`bookshelf.model("user")`).
export const models: Array<{ name: string; model: ModelFactory }> = [
  { name: "user", model: userModel },
  { name: "role", model: roleModel },
  { name: "session", model: sessionModel },
  { name: "apiToken", model: apiTokenModel },
  { name: "deviceGrant", model: deviceGrantModel },
  { name: "authIdentity", model: authIdentityModel },
  { name: "organization", model: organizationModel },
  { name: "membership", model: membershipModel },
  { name: "organizationRole", model: organizationRoleModel },
  { name: "invitation", model: invitationModel },
];
