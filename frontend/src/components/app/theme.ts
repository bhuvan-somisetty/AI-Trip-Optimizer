"use client";

import { useEffect } from "react";

/** The workspace is dark only: there is no light mode. Removed on unmount so the landing and login pages keep their own look. */
export function useApplyTheme() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    return () => root.classList.remove("dark");
  }, []);
}
