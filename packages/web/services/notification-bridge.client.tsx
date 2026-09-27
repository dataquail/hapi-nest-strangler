"use client";

// Turns notification state into sonner calls; mounted by the provider in the
// app and by the integration harness in tests.

import { showToast } from "@org/components/primitives/toaster";
import * as React from "react";

import { notificationStore } from "./notifications.shared";

export const NotificationBridge: React.FC = () => {
  React.useEffect(
    () =>
      notificationStore.subscribe(() => {
        const notification = notificationStore.get();
        if (notification !== null) showToast(notification.kind, notification.message);
      }),
    [],
  );
  return null;
};
