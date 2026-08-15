"use client";

import { useEffect } from "react";

// Tiny client-only helper: the dashboard page is a Server Component, so
// it can't run a useEffect itself. When voice control navigates here
// with a hash (e.g. /student/dashboard#voice-tests-section) from a
// different page, this scrolls to that section once mounted. Plain
// same-page anchor navigation (already on the dashboard) is handled
// directly in VoiceControl instead, since a hash-only URL change
// doesn't remount this component.
export function ScrollToHash() {
  useEffect(() => {
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    // Give the page a tick to finish laying out before scrolling.
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
    return () => clearTimeout(t);
  }, []);

  return null;
}
