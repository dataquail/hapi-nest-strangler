"use client";

import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { Input } from "@org/components/primitives/input";
import { Label } from "@org/components/primitives/label";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useInviteFormViewModel } from "./invite-form.view-model";

export const InviteForm: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const { fields, isSubmitting, setEmail, submit, visibleErrors } = useInviteFormViewModel(orgId);

  return (
    <Form onSubmit={submit}>
      <Form.Control>
        <Label htmlFor="invite-email">Invitee email</Label>
        <Input
          type="email"
          id="invite-email"
          value={fields.email}
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          placeholder="teammate@example.com"
          data-testid="invite-email"
        />
        <Form.Error error={visibleErrors?.email} />
      </Form.Control>

      <Button type="submit" width="full" disabled={isSubmitting} data-testid="invite-submit">
        {isSubmitting ? "Sending…" : "Send invitation"}
      </Button>
    </Form>
  );
};
