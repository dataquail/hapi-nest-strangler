// ViewModel for accepting an invitation. On success the caller is moved into
// the org they just joined; the 410 Gone cases leave them on the page with the
// server's own explanation.

import { queryKeys } from "@/services/api/query-keys";
import { acceptInvitation } from "@/services/data-access/orgs.queries";
import { navigateTo } from "@/services/navigation.shared";
import { useApiMutation } from "@/services/query/use-api-mutation";

export type AcceptInvitationViewModel = {
  readonly accept: () => void;
  readonly isAccepting: boolean;
};

export const useAcceptInvitationViewModel = (token: string): AcceptInvitationViewModel => {
  const mutation = useApiMutation({
    mutationFn: () => acceptInvitation(token),
    invalidates: [queryKeys.organizations.all],
    notify: {
      success: () => "Invitation accepted!",
      errors: {
        InvitationNotFoundError: (error) => error.message,
        InvitationGoneError: (error) => error.message,
      },
    },
    onSuccess: (accepted) => {
      navigateTo(`/orgs/${accepted.organizationId}`);
    },
  });
  return {
    accept: () => {
      mutation.mutate(undefined);
    },
    isAccepting: mutation.isPending,
  };
};
