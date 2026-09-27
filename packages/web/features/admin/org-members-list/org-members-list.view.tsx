"use client";

import { EmptyState } from "@org/components/patterns/empty-state";
import { ListRow } from "@org/components/patterns/list-row";
import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import { List } from "@org/components/primitives/list";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useOrgMembersListViewModel } from "./org-members-list.view-model";

// Shared roster for the super-admin drill-in, the org-admin members page and,
// read-only, the plain-member members page. `canManage` hides the controls
// for non-admins; the backend still refuses the mutation regardless.
export const OrgMembersList: React.FC<{
  readonly orgId: OrganizationId;
  readonly canManage?: boolean;
}> = ({ canManage = true, orgId }) => {
  const { demote, isChangingRole, isEmpty, isRemoving, promote, remove, rows } =
    useOrgMembersListViewModel(orgId);

  if (isEmpty) {
    return <EmptyState message="No members in this organization yet." />;
  }

  return (
    <List gap="sm" data-testid="admin-org-members">
      {rows.map((row) => (
        <List.Item key={row.userId}>
          <ListRow
            data-testid="admin-org-members-row"
            trailing={
              canManage ? (
                <Stack direction="row" gap="sm" align="center">
                  {row.isAdmin ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isChangingRole}
                      onClick={() => {
                        demote(row.userId);
                      }}
                      data-testid="admin-org-members-demote"
                    >
                      Demote
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isChangingRole}
                      onClick={() => {
                        promote(row.userId);
                      }}
                      data-testid="admin-org-members-promote"
                    >
                      Promote
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isRemoving}
                    onClick={() => {
                      remove(row.userId);
                    }}
                    data-testid="admin-org-members-remove"
                  >
                    Remove
                  </Button>
                </Stack>
              ) : undefined
            }
          >
            <Stack direction="row" gap="sm" align="center">
              <Text weight="medium" truncate>
                {row.email}
              </Text>
              {row.isAdmin && (
                <Badge variant="default" data-testid="admin-org-members-admin-badge">
                  Admin
                </Badge>
              )}
            </Stack>
            <Text size="xs" tone="muted">
              Joined {row.joinedAtLabel}
            </Text>
          </ListRow>
        </List.Item>
      ))}
    </List>
  );
};
