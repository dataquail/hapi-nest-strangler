"use client";

import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useBillingPanelViewModel } from "./billing-panel.view-model";

export const BillingPanel: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const view = useBillingPanelViewModel(orgId);

  return (
    <Stack direction="column" gap="lg" data-testid="billing-panel">
      <Stack direction="row" align="start" justify="between">
        <Stack direction="column" gap="xs">
          <Text weight="medium" tone="muted">
            Status
          </Text>
          <Badge variant={view.statusVariant} data-testid="billing-status">
            {view.statusLabel}
          </Badge>
        </Stack>
        {view.currentPeriodEndLabel !== null && (
          <Stack direction="column" gap="xs" align="end">
            <Text weight="medium" tone="muted" align="end">
              Current period ends
            </Text>
            <Text align="end" data-testid="billing-period-end">
              {view.currentPeriodEndLabel}
            </Text>
          </Stack>
        )}
      </Stack>

      <Stack direction="row" gap="sm">
        {view.canStart && (
          <Button onClick={view.start} disabled={view.isStarting} data-testid="billing-start">
            {view.isStarting ? "Starting…" : "Start subscription"}
          </Button>
        )}
        {view.canCancel && (
          <Button
            variant="destructive"
            onClick={view.cancel}
            disabled={view.isCanceling}
            data-testid="billing-cancel"
          >
            {view.isCanceling ? "Canceling…" : "Cancel subscription"}
          </Button>
        )}
      </Stack>
    </Stack>
  );
};
