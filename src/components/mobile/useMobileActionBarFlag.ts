"use client";

import { useEffect } from "react";

/**
 * F14: marks on <body> that a sticky mobile action bar is on screen.
 * AppShell's floating action stack reads this flag (via CSS) and lifts
 * itself above the bar so the FABs never cover it.
 */
export function useMobileActionBarFlag(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    document.body.dataset.mobileActionBar = "1";
    return () => {
      delete document.body.dataset.mobileActionBar;
    };
  }, [active]);
}
