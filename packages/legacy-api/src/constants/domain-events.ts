// hapi server events the domain-event-handler plugin subscribes to; services
// emit them after their transaction commits.
export const domainEvents = {
  INVITATION_ISSUED: "invitation-issued",
  INVITATION_REISSUED: "invitation-reissued",
  ORGANIZATION_CREATED: "organization-created",
} as const;
