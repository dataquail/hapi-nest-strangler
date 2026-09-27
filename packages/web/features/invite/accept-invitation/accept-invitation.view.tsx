"use client";

import { Button } from "@org/components/primitives/button";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";

import { useAcceptInvitationViewModel } from "./accept-invitation.view-model";

export const AcceptInvitation: React.FC<{ readonly token: string }> = ({ token }) => {
  const { accept, isAccepting } = useAcceptInvitationViewModel(token);

  return (
    <Stack direction="column" gap="lg">
      <Text tone="muted">
        You&apos;ve been invited to join an organization. Click below to accept.
      </Text>
      <Button width="full" onClick={accept} disabled={isAccepting} data-testid="invitation-accept">
        {isAccepting ? "Accepting…" : "Accept invitation"}
      </Button>
    </Stack>
  );
};
