"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

const storageKey = "hackdraft-theme";
type Theme = "light" | "dark";
function getTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}
function subscribe(callback: () => void) {
  window.addEventListener("hackdraft-theme-change", callback);
  return () => window.removeEventListener("hackdraft-theme-change", callback);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");
  useLayoutEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    const next: Theme = stored === "light" || stored === "dark" ? stored : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event("hackdraft-theme-change"));
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem(storageKey, next);
    window.dispatchEvent(new Event("hackdraft-theme-change"));
  }
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
    <span className="theme-toggle-icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
    <span className="hidden sm:inline">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
  </button>;
}
