"use client";

import { EmptyState } from "@org/components/patterns/empty-state";
import { ListRow } from "@org/components/patterns/list-row";
import { Pagination } from "@org/components/patterns/pagination";
import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import { Link } from "@org/components/primitives/link";
import { List } from "@org/components/primitives/list";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";

import { type OrgRowView, useOrgsListViewModel } from "./orgs-list.view-model";

const RowName: React.FC<{ readonly row: OrgRowView }> = ({ row }) =>
  row.href === null ? (
    <Text weight="medium" truncate>
      {row.name}
    </Text>
  ) : (
    <Link href={row.href} tone="default" underline="hover" data-testid="admin-orgs-row-link">
      <Text weight="medium" truncate>
        {row.name}
      </Text>
    </Link>
  );

export const OrgsList: React.FC = () => {
  const view = useOrgsListViewModel();

  return (
    <Stack direction="column" gap="lg">
      <Stack direction="row" align="center" justify="between">
        <Button
          variant="outline"
          size="sm"
          onClick={view.toggleIncludeDeleted}
          data-testid="orgs-toggle-deleted"
        >
          {view.includeDeleted ? "Hide deleted" : "Show deleted"}
        </Button>
        <Text tone="muted">{view.total} total</Text>
      </Stack>

      {view.isEmpty ? (
        <EmptyState message="No organizations." />
      ) : (
        <List gap="sm" data-testid="admin-orgs-list">
          {view.rows.map((row) => (
            <List.Item key={row.id}>
              <ListRow
                data-testid="admin-orgs-row"
                trailing={
                  <Stack direction="row" gap="sm" align="center">
                    <Badge variant={row.isDeleted ? "outline" : "default"}>
                      {row.isDeleted ? "Deleted" : "Active"}
                    </Badge>
                    {row.isDeleted ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          view.restore(row.id);
                        }}
                        data-testid="admin-orgs-restore"
                      >
                        Restore
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          view.softDelete(row.id);
                        }}
                        data-testid="admin-orgs-delete"
                      >
                        Delete
                      </Button>
                    )}
                  </Stack>
                }
              >
                <RowName row={row} />
                <Text size="xs" tone="muted">
                  Created {row.createdAtLabel}
                </Text>
                {row.deletedAtLabel !== null && (
                  <Text size="xs" tone="destructive">
                    Deleted {row.deletedAtLabel}
                  </Text>
                )}
              </ListRow>
            </List.Item>
          ))}
        </List>
      )}

      <Pagination
        page={view.page}
        totalPages={view.totalPages}
        total={view.total}
        hasPrevious={view.hasPrevious}
        hasNext={view.hasNext}
        onPrevious={() => {
          view.changePage("previous");
        }}
        onNext={() => {
          view.changePage("next");
        }}
        itemLabel="organizations"
      />
    </Stack>
  );
};
