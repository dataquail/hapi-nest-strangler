import * as AuthContract from "./api/AuthContract.js";
import * as BillingContract from "./api/BillingContract.js";
import * as OrganizationContract from "./api/OrganizationContract.js";
import * as TodosContract from "./api/TodosContract.js";
import * as UserContract from "./api/UserContract.js";
import type { ContractGroup } from "./Route.js";

/** The browser-facing API: every group the web renderer reaches through `/api/*`. */
export const DomainApi: ReadonlyArray<ContractGroup> = [
  TodosContract.Group,
  UserContract.Group,
  OrganizationContract.Group,
  OrganizationContract.AdminGroup,
  OrganizationContract.InvitationGroup,
  AuthContract.PublicGroup,
  AuthContract.PrivateGroup,
  AuthContract.TokensGroup,
  AuthContract.DeviceApprovalGroup,
  BillingContract.PrivateGroup,
  BillingContract.PublicGroup,
];
