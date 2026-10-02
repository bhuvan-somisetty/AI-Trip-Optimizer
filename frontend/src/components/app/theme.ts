"use client";

import { useEffect } from "react";
import type { Settings } from "@/lib/types";

export function useApplyTheme(theme: Settings["theme"]) {
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
      root.classList.remove("dark");
    };
  }, [theme]);
}
