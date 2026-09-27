"use client";

import { Button } from "@org/components/primitives/button";
import { PlusIcon } from "@org/components/primitives/icon";
import { Select } from "@org/components/primitives/select";
import { Stack } from "@org/components/primitives/stack";
import { Text } from "@org/components/primitives/text";

import { useOrgSwitcherViewModel } from "./org-switcher.view-model";

export const OrgSwitcher: React.FC = () => {
  const { activeOrgId, createNew, isEmpty, options, selectOrg } = useOrgSwitcherViewModel();

  if (isEmpty) return null;

  return (
    <Stack direction="row" gap="xs" align="center">
      <Select value={activeOrgId ?? undefined} onValueChange={selectOrg}>
        <Select.Trigger width="md" data-testid="org-switcher">
          <Select.Value placeholder="Select an organization…" />
        </Select.Trigger>
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option.id} value={option.id} data-testid="org-switcher-option">
              {option.name}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={createNew}
        aria-label="Create a new organization"
        data-testid="org-switcher-create-new"
      >
        <PlusIcon />
        <Text as="span" srOnly>
          Create a new organization
        </Text>
      </Button>
    </Stack>
  );
};
