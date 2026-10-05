// Assertions read the memberships and organization roles the session strategy
// preloads on the user, so no query runs here. A miss falls through with
// `next()` rather than denying: a super admin carries USER too, and the global
// super-admin allow sits below every module rule.
export const fromOwnOrganization = function (
  err: Error | undefined,
  user: any,
  resource: any,
  _action: string,
  result: (error?: Error, allowed?: boolean) => void,
  next: () => void,
) {
  if (err) throw err;
  if (!resource || typeof resource.get !== "function") {
    next();
    return;
  }
  if (user.isMemberOf(resource.get("id"))) {
    result(undefined, true);
    return;
  }
  next();
};

export const asOrganizationAdmin = function (
  err: Error | undefined,
  user: any,
  resource: any,
  _action: string,
  result: (error?: Error, allowed?: boolean) => void,
  next: () => void,
) {
  if (err) throw err;
  if (!resource || typeof resource.get !== "function") {
    next();
    return;
  }
  if (user.isAdminOf(resource.get("id"))) {
    result(undefined, true);
    return;
  }
  next();
};
