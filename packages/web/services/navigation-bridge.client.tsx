"use client";

// The one component that holds the Next router.

import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { navigationRequestStore, pathnameStore } from "./navigation.shared";

export const NavigationBridge: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    pathnameStore.set(pathname);
  }, [pathname]);

  React.useEffect(
    () =>
      navigationRequestStore.subscribe(() => {
        const request = navigationRequestStore.get();
        if (request !== null) router.push(request.href);
      }),
    [router],
  );

  return null;
};
