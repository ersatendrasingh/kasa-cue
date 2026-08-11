"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LoadingOverlay } from "@/components/ui/loading-overlay";

const NAVIGATION_TIMEOUT_MS = 15_000;

export function RouteTransitionOverlay() {
  const pathname = usePathname();
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const isNavigating = Boolean(
    navigationTarget && navigationTarget !== pathname
  );

  useEffect(() => {
    if (navigationTarget === pathname && timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [navigationTarget, pathname]);

  useEffect(() => {
    function beginNavigation(targetPathname: string) {
      setNavigationTarget(targetPathname);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setNavigationTarget(null);
        timeoutRef.current = null;
      }, NAVIGATION_TIMEOUT_MS);
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      const anchor =
        target instanceof Element ? target.closest<HTMLAnchorElement>("a[href]") : null;

      if (
        !anchor ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);

      if (
        destination.origin !== current.origin ||
        (destination.pathname === current.pathname &&
          destination.search === current.search)
      ) {
        return;
      }

      beginNavigation(destination.pathname);
    }

    function handleHistoryNavigation() {
      beginNavigation(window.location.pathname);
    }

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handleHistoryNavigation);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handleHistoryNavigation);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return isNavigating ? (
    <LoadingOverlay
      description="Fetching the latest information."
      label="Opening page"
    />
  ) : null;
}
