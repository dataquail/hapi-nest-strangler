"use client";

import { EmptyState } from "@org/components/patterns/empty-state";
import { ListRow } from "@org/components/patterns/list-row";
import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import { List } from "@org/components/primitives/list";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useOrgInvitationsListViewModel } from "./org-invitations-list.view-model";

export const OrgInvitationsList: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const { isEmpty, isResending, isRevoking, resend, revoke, rows } =
    useOrgInvitationsListViewModel(orgId);

  if (isEmpty) {
    return <EmptyState message="No pending invitations." />;
  }

  return (
    <List gap="sm" data-testid="org-invitations">
      {rows.map((row) => (
        <List.Item key={row.invitationId}>
          <ListRow
            data-testid="org-invitations-row"
            trailing={
              <Stack direction="row" gap="sm" align="center">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isResending}
                  onClick={() => {
                    resend(row.invitationId);
                  }}
                  data-testid="org-invitations-resend"
                >
                  Resend
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isRevoking}
                  onClick={() => {
                    revoke(row.invitationId);
                  }}
                  data-testid="org-invitations-revoke"
                >
                  Revoke
                </Button>
              </Stack>
            }
          >
            <Stack direction="row" gap="sm" align="center">
              <Text weight="medium" truncate>
                {row.email}
              </Text>
              <Badge
                variant={row.isExpired ? "destructive" : "secondary"}
                data-testid="org-invitations-status"
              >
                {row.isExpired ? "Expired" : "Pending"}
              </Badge>
            </Stack>
            <Text size="xs" tone="muted">
              Expires {row.expiresAtLabel}
            </Text>
          </ListRow>
        </List.Item>
      ))}
    </List>
  );
};
