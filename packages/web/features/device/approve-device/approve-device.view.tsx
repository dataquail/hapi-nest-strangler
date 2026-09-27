"use client";

import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { Input } from "@org/components/primitives/input";
import { Label } from "@org/components/primitives/label";
import { Text } from "@org/components/primitives/text";

import { useApproveDeviceViewModel } from "./approve-device.view-model";

export const ApproveDevice: React.FC<{ readonly initialCode: string }> = ({ initialCode }) => {
  const { fields, isApproved, isSubmitting, setUserCode, submit, visibleErrors } =
    useApproveDeviceViewModel(initialCode);

  if (isApproved) {
    return (
      <Text data-testid="device-approved">
        Device approved — you can return to your terminal. The CLI is now signed in.
      </Text>
    );
  }

  return (
    <Form onSubmit={submit}>
      <Form.Control>
        <Label htmlFor="device-code">Device code</Label>
        <Input
          id="device-code"
          value={fields.userCode}
          onChange={(event) => {
            setUserCode(event.target.value);
          }}
          placeholder="ABCD-2345"
          data-testid="device-code-input"
        />
        <Form.Error error={visibleErrors?.userCode} />
      </Form.Control>

      <Button
        type="submit"
        width="full"
        disabled={isSubmitting}
        data-testid="device-approve-submit"
      >
        {isSubmitting ? "Approving…" : "Approve device"}
      </Button>
    </Form>
  );
};
