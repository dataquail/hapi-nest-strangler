"use client";

import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { Input } from "@org/components/primitives/input";
import { Label } from "@org/components/primitives/label";

import { useCreateOrgViewModel } from "./create-org.view-model";

export const CreateOrg: React.FC = () => {
  const { fields, isSubmitting, setName, submit, visibleErrors } = useCreateOrgViewModel();

  return (
    <Form onSubmit={submit}>
      <Form.Control>
        <Label htmlFor="create-org-name">Organization name</Label>
        <Input
          id="create-org-name"
          value={fields.name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Acme Inc."
          data-testid="create-org-name"
        />
        <Form.Error error={visibleErrors?.name} />
      </Form.Control>

      <Button type="submit" width="full" disabled={isSubmitting} data-testid="create-org-submit">
        {isSubmitting ? "Creating…" : "Create organization"}
      </Button>
    </Form>
  );
};
